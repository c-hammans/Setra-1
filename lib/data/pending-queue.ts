export type PendingChangeBase={key:string;operationId:string;revision:number;updatedAt:string};
export type DurablePendingChangeBase=PendingChangeBase&{supersedesOperationId?:string};

export function mergeUniqueOperations<T extends {operationId:string}>(legacy:T[],current:T[]):T[]{
  const merged=[...current];
  const known=new Set(current.map(item=>item.operationId));
  for(const item of legacy){
    if(known.has(item.operationId))continue;
    merged.push(item);known.add(item.operationId);
  }
  return merged;
}

export function nextRevision(current:PendingChangeBase[],key:string,now=Date.now()){
  const highest=current.filter(item=>item.key===key).reduce((value,item)=>Math.max(value,item.revision||0),0);
  return Math.max(now*1000,highest+1);
}

export function acknowledgeRevision<T extends PendingChangeBase>(current:T[],key:string,operationId:string){
  return current.filter(item=>!(item.key===key&&item.operationId===operationId));
}

export function hasNewerRevision(current:PendingChangeBase[],key:string,revision:number){
  return current.some(item=>item.key===key&&item.revision>revision);
}

export function normalizePendingChanges<T extends {key:string;updatedAt?:string;operationId?:string;revision?:number}>(items:T[]){
  const counters=new Map<string,number>();
  return items.map((item,index)=>{
    const fallbackTime=Date.parse(item.updatedAt||"")||index+1;
    const previous=counters.get(item.key)||0;
    const revision=Number.isSafeInteger(item.revision)&&Number(item.revision)>previous?Number(item.revision):Math.max(fallbackTime*1000,previous+1);
    counters.set(item.key,revision);
    return {...item,updatedAt:item.updatedAt||new Date(fallbackTime).toISOString(),operationId:item.operationId||`legacy-${item.key}-${revision}-${index}`,revision};
  });
}

type ChangeLike=PendingChangeBase&{kind:string;payload?:unknown};
const isDelete=(kind:string)=>kind.startsWith("delete_");

// Keep one durable final intent per entity. Completion and deletion are
// barriers: an older autosave must never be allowed to undo either one.
export function compactPendingChanges<T extends ChangeLike>(items:T[]):T[]{
  const byKey=new Map<string,T[]>();
  for(const item of items)byKey.set(item.key,[...(byKey.get(item.key)||[]),item]);
  const keep=new Set<string>();
  for(const changes of byKey.values()){
    const ordered=[...changes].sort((a,b)=>a.revision-b.revision);
    const lastDelete=[...ordered].reverse().find(item=>isDelete(item.kind));
    if(lastDelete){keep.add(lastDelete.operationId);continue}
    const lastCompleted=[...ordered].reverse().find(item=>item.kind==="save_workout"&&((item.payload as {status?:string}|undefined)?.status==="completed"));
    const newest=ordered[ordered.length-1];
    if(lastCompleted&&newest.kind==="save_workout"&&((newest.payload as {status?:string}|undefined)?.status!=="completed"))keep.add(lastCompleted.operationId);
    else keep.add(newest.operationId);
  }
  return items.filter(item=>keep.has(item.operationId));
}

// Operations written by one editor form an explicit chain. Independent tabs
// that branch from the same cloud version remain separate leaves so one tab
// can never silently overwrite the other in browser storage.
export function selectDurablePendingLeaves<T extends ChangeLike&{supersedesOperationId?:string;protocolVersion?:number}>(items:T[]):T[]{
  const ids=new Set(items.map(item=>item.operationId));
  const superseded=new Set(items.map(item=>item.supersedesOperationId).filter((value):value is string=>Boolean(value&&ids.has(value))));
  const durable=items.filter(item=>item.protocolVersion===2||item.supersedesOperationId||superseded.has(item.operationId));
  const legacy=items.filter(item=>item.protocolVersion!==2&&!item.supersedesOperationId&&!superseded.has(item.operationId));
  const durableLeaves=durable.filter(item=>!superseded.has(item.operationId));
  const legacyLeaves=compactPendingChanges(legacy);
  return [...durableLeaves,...legacyLeaves].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.operationId.localeCompare(b.operationId));
}

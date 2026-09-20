export type PendingChangeBase={key:string;operationId:string;revision:number;updatedAt:string};

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

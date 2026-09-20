const entityTails=new Map<string,Promise<unknown>>();

export function runOrderedWrite<T>(entityKey:string,write:()=>Promise<T>):Promise<T>{
  const previous=entityTails.get(entityKey)||Promise.resolve();
  const current=previous.catch(()=>undefined).then(write);
  entityTails.set(entityKey,current);
  void current.finally(()=>{if(entityTails.get(entityKey)===current)entityTails.delete(entityKey)}).catch(()=>undefined);
  return current;
}

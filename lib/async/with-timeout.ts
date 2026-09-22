export async function withTimeout<T>(promise:Promise<T>,milliseconds:number,message="The request took too long. Please try again."):Promise<T>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([promise,new Promise<T>((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds)})])}
  finally{if(timer)clearTimeout(timer)}
}

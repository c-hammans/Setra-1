export type WriteOperation={operationId:string;expectedVersion:number;revision:number;protocolVersion?:2};

export const legacyRevision=(operation:WriteOperation|number)=>typeof operation==="number"?operation:operation.revision;
export const isVersionedOperation=(operation:WriteOperation|number):operation is WriteOperation=>typeof operation!=="number"&&operation.protocolVersion===2;

export function rpcVersion(data:unknown){
  const value=Array.isArray(data)?data[0]:data;
  const candidate=value&&typeof value==="object"&&"server_version" in value?(value as {server_version:unknown}).server_version:value;
  const version=Number(candidate);
  if(!Number.isSafeInteger(version)||version<0)throw new Error("Cloud write did not return a valid server version.");
  return version;
}

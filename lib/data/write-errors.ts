export type WriteErrorKind="stale"|"conflict"|"transient"|"authentication"|"validation"|"permanent";

export class NormalizedWriteError extends Error{
  readonly kind:WriteErrorKind;
  readonly code?:string;
  readonly details?:string;
  readonly hint?:string;
  constructor(message:string,kind:WriteErrorKind,metadata:{code?:string;details?:string;hint?:string}={}){
    super(message);this.name="NormalizedWriteError";this.kind=kind;this.code=metadata.code;this.details=metadata.details;this.hint=metadata.hint;
  }
}

type ErrorLike={message?:unknown;code?:unknown;details?:unknown;hint?:unknown;status?:unknown};
const text=(value:unknown)=>typeof value==="string"?value:"";

export function normalizeWriteError(value:unknown):NormalizedWriteError{
  const source=(value&&typeof value==="object"?value:{}) as ErrorLike;
  const message=value instanceof Error?value.message:text(source.message)||"The change could not be synced.";
  const code=text(source.code);
  const details=text(source.details);
  const hint=text(source.hint);
  const status=Number(source.status);
  const combined=`${message} ${code} ${details} ${hint}`.toUpperCase();
  let kind:WriteErrorKind="permanent";
  if(combined.includes("STALE_WRITE"))kind="stale";
  else if(combined.includes("WRITE_CONFLICT")||code==="23505")kind="conflict";
  else if(combined.includes("VALIDATION")||code==="22023"||code==="23514")kind="validation";
  else if(status===401||status===403||code==="42501"||combined.includes("AUTHENTICATION REQUIRED"))kind="authentication";
  else if(status>=500||["08000","08003","08006","08001","08004","57P01","57P02","57P03","PGRST000","PGRST001","PGRST002"].includes(code)||combined.includes("NETWORK")||combined.includes("FETCH"))kind="transient";
  return new NormalizedWriteError(message,kind,{code:code||undefined,details:details||undefined,hint:hint||undefined});
}

export function userWriteErrorMessage(error:unknown){
  const normalized=normalizeWriteError(error);
  if(normalized.kind==="conflict"||normalized.kind==="stale")return "This item changed on another device. Your version is still saved on this device; refresh and review before retrying.";
  if(normalized.kind==="authentication")return "Your session needs attention. Sign in again; your change is still saved on this device.";
  if(normalized.kind==="validation")return normalized.message.replace(/^VALIDATION:\s*/i,"");
  if(normalized.kind==="transient")return "Cloud sync is temporarily unavailable. Your change is saved on this device and will retry automatically.";
  return "Cloud sync needs attention. Your change is still saved on this device.";
}

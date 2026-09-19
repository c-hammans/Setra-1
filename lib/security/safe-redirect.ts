export function safeInternalRedirect(value:string|null|undefined,fallback="/"){
  if(!value||!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return fallback;
  try{
    const decoded=decodeURIComponent(value);
    if(decoded.startsWith("//")||decoded.includes("\\"))return fallback;
  }catch{return fallback}
  return value;
}

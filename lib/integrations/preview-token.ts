import {createHmac,timingSafeEqual} from "node:crypto";
import type {NormalizedActivity} from "./activity.ts";

type Preview={userId:string;fingerprint:string;activity:NormalizedActivity;zone:string;expires:number};
const signature=(value:string,key:string)=>createHmac("sha256",key).update("setra-activity-preview-v1:"+value).digest();
export function signActivityPreview(value:Omit<Preview,"expires">,key:string){
  const encoded=Buffer.from(JSON.stringify({...value,expires:Date.now()+60*60*1000})).toString("base64url");
  return encoded+"."+signature(encoded,key).toString("base64url");
}
export function readActivityPreview(token:unknown,userId:string,key:string):Preview|null{
  if(typeof token!=="string"||token.length>400000)return null;
  const parts=token.split(".");
  if(parts.length!==2||!parts.every(value=>/^[a-zA-Z0-9_-]+$/.test(value)))return null;
  const supplied=Buffer.from(parts[1],"base64url"),expected=signature(parts[0],key);
  if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
  try{
    const value=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8")) as Preview;
    return value.userId===userId&&value.expires>Date.now()?value:null;
  }catch{return null}
}

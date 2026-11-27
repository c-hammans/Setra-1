import type {AskSetraAnswer} from "./ask-setra-types";

export const ASK_SETRA_PROMPT_VERSION="ask-setra-v1";
export const askSetraJsonSchema={type:"object",additionalProperties:false,properties:{facts:{type:"array",items:{type:"string"},minItems:1,maxItems:5},interpretation:{type:["string","null"]},recommendations:{type:"array",items:{type:"string"},maxItems:3},dataConfidence:{type:"object",additionalProperties:false,properties:{level:{type:"string",enum:["high","medium","limited"]},summary:{type:"string"},gaps:{type:"array",items:{type:"string"},maxItems:5}},required:["level","summary","gaps"]},suggestedFollowUps:{type:"array",items:{type:"string"},maxItems:3},safetyNote:{type:["string","null"]}},required:["facts","interpretation","recommendations","dataConfidence","suggestedFollowUps","safetyNote"]} as const;
const stringArray=(value:unknown,min:number,max:number)=>Array.isArray(value)&&value.length>=min&&value.length<=max&&value.every(item=>typeof item==="string"&&item.trim()&&item.length<=600);
const clean=(value:string)=>value.trim().replaceAll("\u2014","\u2013");
export function parseAskSetraAnswer(value:unknown):AskSetraAnswer{
  if(!value||typeof value!=="object")throw new Error("Ask Setra returned an invalid answer.");const item=value as Record<string,unknown>;const confidence=item.dataConfidence as Record<string,unknown>|undefined;
  if(!stringArray(item.facts,1,5)||!stringArray(item.recommendations,0,3)||!stringArray(item.suggestedFollowUps,0,3))throw new Error("Ask Setra returned incomplete answer sections.");
  if(item.interpretation!==null&&typeof item.interpretation!=="string")throw new Error("Ask Setra returned an invalid interpretation.");if(item.safetyNote!==null&&typeof item.safetyNote!=="string")throw new Error("Ask Setra returned an invalid safety note.");
  if(!confidence||!["high","medium","limited"].includes(String(confidence.level))||typeof confidence.summary!=="string"||!stringArray(confidence.gaps,0,5))throw new Error("Ask Setra returned invalid data confidence.");
  return {facts:(item.facts as string[]).map(clean),interpretation:item.interpretation===null?null:clean(item.interpretation as string),recommendations:(item.recommendations as string[]).map(clean),dataConfidence:{level:confidence.level as AskSetraAnswer["dataConfidence"]["level"],summary:clean(confidence.summary),gaps:(confidence.gaps as string[]).map(clean)},suggestedFollowUps:(item.suggestedFollowUps as string[]).map(clean),safetyNote:item.safetyNote===null?null:clean(item.safetyNote as string)};
}

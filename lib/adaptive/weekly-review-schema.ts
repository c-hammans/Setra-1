import type {WeeklyReviewContent} from "./weekly-review-types";

export const WEEKLY_REVIEW_PROMPT_VERSION="weekly-review-v1";

export const weeklyReviewJsonSchema={
  type:"object",additionalProperties:false,
  properties:{
    weekAtAGlance:{type:"array",items:{type:"string"},minItems:2,maxItems:4},
    whatWentWell:{type:"array",items:{type:"string"},minItems:1,maxItems:3},
    worthNoting:{type:"array",items:{type:"string"},minItems:1,maxItems:3},
    lookingAhead:{type:"array",items:{type:"string"},minItems:1,maxItems:3},
    dataConfidence:{type:"object",additionalProperties:false,properties:{level:{type:"string",enum:["high","medium","limited"]},summary:{type:"string"},gaps:{type:"array",items:{type:"string"},maxItems:5}},required:["level","summary","gaps"]},
  },
  required:["weekAtAGlance","whatWentWell","worthNoting","lookingAhead","dataConfidence"],
} as const;

const strings=(value:unknown,min:number,max:number)=>Array.isArray(value)&&value.length>=min&&value.length<=max&&value.every(item=>typeof item==="string"&&item.trim().length>0&&item.length<=500);

export function parseWeeklyReviewContent(value:unknown):WeeklyReviewContent{
  if(!value||typeof value!=="object")throw new Error("The generated review was not valid.");
  const item=value as Record<string,unknown>;const confidence=item.dataConfidence as Record<string,unknown>|undefined;
  if(!strings(item.weekAtAGlance,2,4)||!strings(item.whatWentWell,1,3)||!strings(item.worthNoting,1,3)||!strings(item.lookingAhead,1,3))throw new Error("The generated review sections were incomplete.");
  if(!confidence||!["high","medium","limited"].includes(String(confidence.level))||typeof confidence.summary!=="string"||!strings(confidence.gaps,0,5))throw new Error("The generated review confidence was invalid.");
  const clean=(text:string)=>text.trim().replaceAll("\u2014","\u2013");
  return {weekAtAGlance:(item.weekAtAGlance as string[]).map(clean),whatWentWell:(item.whatWentWell as string[]).map(clean),worthNoting:(item.worthNoting as string[]).map(clean),lookingAhead:(item.lookingAhead as string[]).map(clean),dataConfidence:{level:confidence.level as WeeklyReviewContent["dataConfidence"]["level"],summary:clean(confidence.summary),gaps:(confidence.gaps as string[]).map(clean)}};
}

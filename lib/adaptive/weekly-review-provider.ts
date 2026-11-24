import "server-only";
import {parseWeeklyReviewContent,weeklyReviewJsonSchema,WEEKLY_REVIEW_PROMPT_VERSION} from "./weekly-review-schema";
import type {WeeklyReviewContent,WeeklyReviewContext} from "./weekly-review-types";

export type WeeklyReviewGeneration={content:WeeklyReviewContent;provider:string;model:string;inputTokens:number|null;outputTokens:number|null;estimatedCostUsd:number|null};
export interface WeeklyReviewProvider{generate(context:WeeklyReviewContext):Promise<WeeklyReviewGeneration>}

const SYSTEM_INSTRUCTIONS=`You are Setra's weekly training review assistant. Use only the compact structured training context provided. Never invent sessions, metrics, personal bests, diagnoses, injuries, causes, or user intent. Use calm, concise, neutral training language. Distinguish recorded facts from cautious observations. Do not shame missed training or encourage training through pain, illness, or inappropriate fatigue. When data is sparse, say so. Recommendations must be conservative and optional. Do not use em dashes. Return only the requested JSON schema. Prompt version: ${WEEKLY_REVIEW_PROMPT_VERSION}.`;

class OpenAIWeeklyReviewProvider implements WeeklyReviewProvider{
  async generate(context:WeeklyReviewContext):Promise<WeeklyReviewGeneration>{
    const apiKey=process.env.OPENAI_API_KEY;const model=process.env.OPENAI_WEEKLY_REVIEW_MODEL||"gpt-6-luna";
    if(!apiKey)throw new Error("Adaptive review generation is not configured yet.");
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:SYSTEM_INSTRUCTIONS,input:JSON.stringify(context),max_output_tokens:1200,text:{format:{type:"json_schema",name:"setra_weekly_review",strict:true,schema:weeklyReviewJsonSchema}}}),signal:AbortSignal.timeout(45000)});
    if(!response.ok){const detail=await response.text();throw new Error(`Adaptive review generation failed (${response.status}): ${detail.slice(0,180)}`)}
    const payload=await response.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>;usage?:{input_tokens?:number;output_tokens?:number}};
    const text=payload.output?.flatMap(item=>item.content||[]).find(item=>item.type==="output_text")?.text;
    if(!text)throw new Error("Adaptive review generation returned no review.");
    return {content:parseWeeklyReviewContent(JSON.parse(text)),provider:"openai",model,inputTokens:payload.usage?.input_tokens??null,outputTokens:payload.usage?.output_tokens??null,estimatedCostUsd:null};
  }
}

export function getWeeklyReviewProvider():WeeklyReviewProvider{
  const provider=(process.env.AI_PROVIDER||"openai").toLowerCase();
  if(provider==="openai")return new OpenAIWeeklyReviewProvider();
  throw new Error(`Unsupported AI provider: ${provider}`);
}

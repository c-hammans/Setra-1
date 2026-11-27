import "server-only";
import {getAdaptiveAiProvider} from "./ai-provider";
import {parseWeeklyReviewContent,weeklyReviewJsonSchema,WEEKLY_REVIEW_PROMPT_VERSION} from "./weekly-review-schema";
import type {WeeklyReviewContent,WeeklyReviewContext} from "./weekly-review-types";

export type WeeklyReviewGeneration={content:WeeklyReviewContent;provider:string;model:string;inputTokens:number|null;outputTokens:number|null;estimatedCostUsd:number|null};
export interface WeeklyReviewProvider{generate(context:WeeklyReviewContext):Promise<WeeklyReviewGeneration>}

const SYSTEM_INSTRUCTIONS=`You are Setra's weekly training review assistant. Use only the compact structured training context provided. Never invent sessions, metrics, personal bests, diagnoses, injuries, causes, or user intent. Use calm, concise, neutral training language. Distinguish recorded facts from cautious observations. Do not shame missed training or encourage training through pain, illness, or inappropriate fatigue. When data is sparse, say so. Recommendations must be conservative and optional. Do not use em dashes. Return only the requested JSON schema. Prompt version: ${WEEKLY_REVIEW_PROMPT_VERSION}.`;

class OpenAIWeeklyReviewProvider implements WeeklyReviewProvider{
  async generate(context:WeeklyReviewContext):Promise<WeeklyReviewGeneration>{
    const generated=await getAdaptiveAiProvider().generateStructured({instructions:SYSTEM_INSTRUCTIONS,input:context,schemaName:"setra_weekly_review",schema:weeklyReviewJsonSchema as unknown as Record<string,unknown>,parse:parseWeeklyReviewContent,modelEnv:"OPENAI_WEEKLY_REVIEW_MODEL",defaultModel:"gpt-6-luna",maxOutputTokens:1200});
    return {content:generated.value,provider:generated.usage.provider,model:generated.usage.model,inputTokens:generated.usage.inputTokens,outputTokens:generated.usage.outputTokens,estimatedCostUsd:generated.usage.estimatedCostUsd};
  }
}

export function getWeeklyReviewProvider():WeeklyReviewProvider{
  const provider=(process.env.AI_PROVIDER||"openai").toLowerCase();
  if(provider==="openai")return new OpenAIWeeklyReviewProvider();
  throw new Error(`Unsupported AI provider: ${provider}`);
}

import "server-only";
import {getAdaptiveAiProvider} from "./ai-provider";
import {parseRecommendationDrafts,recommendationJsonSchema,RECOMMENDATION_PROMPT_VERSION} from "./recommendation-schema";
import type {RecommendationCandidate} from "./recommendation-types";

const INSTRUCTIONS=`You are Setra's proactive training recommendation writer. The deterministic rules have already decided which evidence-backed candidates are eligible. Select up to three useful, non-duplicative candidates and turn each direction into concise, cautious, forward-looking copy. Use only the exact candidate evidence and direction provided. Never invent fatigue, readiness, injury, illness, recovery state, trends, sessions, goals or metrics. Do not prescribe treatment. Never imply that Setra changed the user's plan. Prefer "consider" and "based on your recorded training" over commands. Avoid generic motivation. Do not use em dashes. Return only the required JSON. Prompt version: ${RECOMMENDATION_PROMPT_VERSION}.`;

export async function generateRecommendationDrafts(candidates:RecommendationCandidate[]){
  const generated=await getAdaptiveAiProvider().generateStructured({instructions:INSTRUCTIONS,input:{candidates:candidates.map(({key,type,evidence,direction,confidence})=>({candidateKey:key,type,evidence,direction,confidence}))},schemaName:"setra_training_recommendations",schema:recommendationJsonSchema as unknown as Record<string,unknown>,parse:value=>parseRecommendationDrafts(value,candidates),modelEnv:"OPENAI_RECOMMENDATIONS_MODEL",defaultModel:"gpt-6-luna",maxOutputTokens:800});
  return {drafts:generated.value,...generated.usage};
}

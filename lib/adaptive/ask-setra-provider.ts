import "server-only";
import {getAdaptiveAiProvider} from "./ai-provider";
import {askSetraJsonSchema,ASK_SETRA_PROMPT_VERSION,parseAskSetraAnswer} from "./ask-setra-schema";
import type {AskSetraAnswer,AskSetraContext} from "./ask-setra-types";

const INSTRUCTIONS=`You are Ask Setra, a concise training Q&A assistant. Answer only from the supplied compact Setra context and bounded conversation. Separate recorded facts, cautious interpretation, and optional recommendations using the required schema. Never invent sessions, metrics, trends, goals, readiness, fatigue, injury, illness, recovery state, or links. If evidence is missing, state the gap. Do not diagnose medical conditions or tell a user to train through pain or illness. For medical or injury questions, provide only conservative training context and an appropriate professional-support note. Recommendations are advisory and must not imply that Setra changed a plan. Use calm, non-judgmental language with no hype or guilt. Do not use em dashes. Prompt version: ${ASK_SETRA_PROMPT_VERSION}.`;

export async function generateAskSetraAnswer(question:string,context:AskSetraContext){
  const generated=await getAdaptiveAiProvider().generateStructured<AskSetraAnswer>({instructions:INSTRUCTIONS,input:{question,context},schemaName:"ask_setra_answer",schema:askSetraJsonSchema as unknown as Record<string,unknown>,parse:parseAskSetraAnswer,modelEnv:"OPENAI_ASK_SETRA_MODEL",defaultModel:"gpt-6-luna",maxOutputTokens:1000});
  return {answer:generated.value,...generated.usage};
}

import "server-only";
import { adaptiveGenerationEnabled } from "./generation-availability";

export type AiUsage={provider:string;model:string;inputTokens:number|null;outputTokens:number|null;estimatedCostUsd:number|null};
export type StructuredAiResult<T>={value:T;usage:AiUsage};
export type StructuredAiRequest<T>={instructions:string;input:unknown;schemaName:string;schema:Record<string,unknown>;parse:(value:unknown)=>T;modelEnv:string;defaultModel:string;maxOutputTokens:number};
export interface AdaptiveAiProvider{generateStructured<T>(request:StructuredAiRequest<T>):Promise<StructuredAiResult<T>>}

class OpenAiAdaptiveProvider implements AdaptiveAiProvider{
  async generateStructured<T>(request:StructuredAiRequest<T>):Promise<StructuredAiResult<T>>{
    if (!adaptiveGenerationEnabled()) throw new Error("Adaptive generation is disabled.");
    const apiKey=process.env.OPENAI_API_KEY;const model=process.env[request.modelEnv]||request.defaultModel;
    if(!apiKey)throw new Error("Adaptive AI is not configured yet.");
    const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({model,instructions:request.instructions,input:JSON.stringify(request.input),max_output_tokens:request.maxOutputTokens,text:{format:{type:"json_schema",name:request.schemaName,strict:true,schema:request.schema}}}),signal:AbortSignal.timeout(45000)});
    if(!response.ok){const detail=await response.text();throw new Error(`Adaptive AI request failed (${response.status}): ${detail.slice(0,180)}`)}
    const payload=await response.json() as {output?:Array<{content?:Array<{type?:string;text?:string}>}>;usage?:{input_tokens?:number;output_tokens?:number}};
    const output=payload.output?.flatMap(item=>item.content||[]).find(item=>item.type==="output_text")?.text;
    if(!output)throw new Error("Adaptive AI returned no response.");
    return {value:request.parse(JSON.parse(output)),usage:{provider:"openai",model,inputTokens:payload.usage?.input_tokens??null,outputTokens:payload.usage?.output_tokens??null,estimatedCostUsd:null}};
  }
}

export function getAdaptiveAiProvider():AdaptiveAiProvider{
  const provider=(process.env.AI_PROVIDER||"openai").toLowerCase();
  if(provider==="openai")return new OpenAiAdaptiveProvider();
  throw new Error(`Unsupported AI provider: ${provider}`);
}

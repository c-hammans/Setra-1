import "server-only";
import {generateRecommendationDrafts} from "./recommendation-provider";
import {buildRecommendationCandidates} from "./recommendation-rules";
import {RECOMMENDATION_PROMPT_VERSION} from "./recommendation-schema";
import {loadRecommendationSource} from "./recommendation-data";
import type {RecommendationTrigger,StoredRecommendation} from "./recommendation-types";
import type {WeekdayIndex} from "@/lib/setra/week";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client=any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
type Input={admin:Client;auth:Client;userId:string;today:string;timezone:string;weekStartsOn:WeekdayIndex};
const stored=(row:Row):StoredRecommendation=>({id:String(row.id),type:row.recommendation_type,title:String(row.title),recommendation:String(row.recommendation),evidence:Array.isArray(row.evidence)?row.evidence.filter((item:unknown)=>typeof item==="string"):[],confidence:row.confidence,status:row.status,relatedSessionId:row.related_session_id?String(row.related_session_id):null,relatedGoalId:row.related_goal_id?String(row.related_goal_id):null,createdAt:String(row.created_at)});

async function currentRows(admin:Client,userId:string,sourceHash:string){const result=await admin.from("adaptive_training_recommendations").select("*").eq("user_id",userId).eq("source_hash",sourceHash).eq("status","active").order("created_at",{ascending:false}).limit(3);if(result.error)throw result.error;return ((result.data||[]) as Row[]).map(stored)}

export async function inspectRecommendations(input:Input){
  const source=await loadRecommendationSource(input);const built=buildRecommendationCandidates(source);const now=new Date().toISOString();
  const invalidated=await input.admin.from("adaptive_training_recommendations").update({status:"outdated",outdated_at:now}).eq("user_id",input.userId).eq("status","active").neq("source_hash",built.sourceHash);if(invalidated.error)throw invalidated.error;
  const [recommendations,run]=await Promise.all([currentRows(input.admin,input.userId,built.sourceHash),input.admin.from("adaptive_recommendation_runs").select("status").eq("user_id",input.userId).eq("source_hash",built.sourceHash).maybeSingle()]);if(run.error)throw run.error;
  return {source,built,recommendations,evaluationStatus:run.data?.status?String(run.data.status):null};
}

export async function evaluateRecommendations(input:Input&{trigger:RecommendationTrigger}){
  const prepared=await inspectRecommendations(input);if(!prepared.built.candidates.length)return {recommendations:[],sourceHash:prepared.built.sourceHash,candidateCount:0,generated:false,deduplicated:true};
  const claim=await input.admin.rpc("claim_adaptive_recommendation_run",{p_user_id:input.userId,p_source_hash:prepared.built.sourceHash,p_trigger:input.trigger});if(claim.error)throw claim.error;const claimed=(Array.isArray(claim.data)?claim.data[0]:claim.data) as Row;
  if(!claimed.should_generate)return {recommendations:await currentRows(input.admin,input.userId,prepared.built.sourceHash),sourceHash:prepared.built.sourceHash,candidateCount:prepared.built.candidates.length,generated:false,deduplicated:true,pending:claimed.run_status==="generating"};
  const runId=String(claimed.run_id);
  try{
    const generated=await generateRecommendationDrafts(prepared.built.candidates);const candidates=new Map(prepared.built.candidates.map(item=>[item.key,item]));const now=new Date().toISOString();
    const rows=generated.drafts.map(draft=>{const candidate=candidates.get(draft.candidateKey)!;return {run_id:runId,user_id:input.userId,candidate_key:candidate.key,recommendation_type:candidate.type,title:draft.title,recommendation:draft.recommendation,evidence:candidate.evidence,confidence:candidate.confidence,source_hash:prepared.built.sourceHash,related_session_id:candidate.relatedSessionId,related_goal_id:candidate.relatedGoalId,status:"active",created_at:now,updated_at:now}});
    const inserted=await input.admin.from("adaptive_training_recommendations").upsert(rows,{onConflict:"user_id,source_hash,candidate_key"});if(inserted.error)throw inserted.error;
    const run=await input.admin.from("adaptive_recommendation_runs").update({status:"ready",model_provider:generated.provider,model_name:generated.model,prompt_version:RECOMMENDATION_PROMPT_VERSION,input_tokens:generated.inputTokens,output_tokens:generated.outputTokens,estimated_cost_usd:generated.estimatedCostUsd,completed_at:now,error_message:null}).eq("id",runId).eq("user_id",input.userId);if(run.error)throw run.error;
    return {recommendations:await currentRows(input.admin,input.userId,prepared.built.sourceHash),sourceHash:prepared.built.sourceHash,candidateCount:prepared.built.candidates.length,generated:true,deduplicated:false};
  }catch(error){await input.admin.from("adaptive_recommendation_runs").update({status:"failed",error_message:(error instanceof Error?error.message:"Recommendation generation failed.").slice(0,500),completed_at:new Date().toISOString()}).eq("id",runId).eq("user_id",input.userId);throw error}
}

export async function dismissRecommendation(admin:Client,userId:string,id:string){const result=await admin.from("adaptive_training_recommendations").update({status:"dismissed",dismissed_at:new Date().toISOString()}).eq("id",id).eq("user_id",userId).eq("status","active").select("id").maybeSingle();if(result.error)throw result.error;return Boolean(result.data)}

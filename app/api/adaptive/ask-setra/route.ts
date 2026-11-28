import { adaptiveGenerationDisabledResponse, adaptiveGenerationEnabled } from "@/lib/adaptive/generation-availability";
import {NextRequest,NextResponse} from "next/server";
import {loadAskSetraContext} from "@/lib/adaptive/ask-setra-data";
import {generateAskSetraAnswer} from "@/lib/adaptive/ask-setra-provider";
import {ASK_SETRA_PROMPT_VERSION,parseAskSetraAnswer} from "@/lib/adaptive/ask-setra-schema";
import type {AskSetraLink,AskSetraStoredTurn,AskSetraThread} from "@/lib/adaptive/ask-setra-types";
import {hasFeature,normalizePlan,normalizeRoles} from "@/lib/premium/access";
import {readEffectiveAccess} from "@/lib/premium/effective-access";
import type {WeekdayIndex} from "@/lib/setra/week";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient as createServerClient} from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
const validTimezone=(value:unknown)=>{if(typeof value!=="string"||value.length>80)return "UTC";try{new Intl.DateTimeFormat("en",{timeZone:value}).format();return value}catch{return "UTC"}};
const dateInTimezone=(timezone:string)=>{const parts=new Intl.DateTimeFormat("en",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const value=(type:string)=>parts.find(item=>item.type===type)?.value||"";return `${value("year")}-${value("month")}-${value("day")}`};
const linksFrom=(row:Row):AskSetraLink[]=>Array.isArray(row.selected_context?.links)?row.selected_context.links.filter((item:unknown)=>item&&typeof item==="object").slice(0,3):[];
const storedTurn=(row:Row):AskSetraStoredTurn=>({id:String(row.id),threadId:String(row.thread_id),question:String(row.question),status:row.status,answer:row.answer?parseAskSetraAnswer(row.answer):null,links:linksFrom(row),createdAt:String(row.created_at),completedAt:row.completed_at?String(row.completed_at):null,errorMessage:row.error_message?String(row.error_message):null});
const storedThread=(row:Row):AskSetraThread=>({id:String(row.id),title:String(row.title),createdAt:String(row.created_at),updatedAt:String(row.updated_at)});

async function requestState(){
  const auth=await createServerClient();const {data:{user}}=await auth.auth.getUser();if(!user)return null;const admin=createAdminClient();
  const [profile,roles]=await Promise.all([admin.from("profiles").select("individual_plan,subscription_tier,timezone,week_starts_on").eq("id",user.id).single(),admin.from("user_roles").select("role").eq("user_id",user.id)]);
  if(profile.error)throw profile.error;if(roles.error&&roles.error.code!=="42P01")throw roles.error;const access=await readEffectiveAccess(auth)??{plan:normalizePlan(profile.data.individual_plan??profile.data.subscription_tier),roles:normalizeRoles((roles.data||[]).map((item:Row)=>item.role))};
  const timezone=validTimezone(profile.data.timezone);return {auth,admin,user,access,timezone,today:dateInTimezone(timezone),weekStartsOn:(Number(profile.data.week_starts_on)||0) as WeekdayIndex};
}

export async function GET(request:NextRequest){
  try{
    const state=await requestState();if(!state)return NextResponse.json({error:"Please sign in to use Ask Setra."},{status:401});if(!hasFeature(state.access,"ask_setra_training"))return NextResponse.json({locked:true,requiredPlan:"adaptive"},{status:403});
    const requested=request.nextUrl.searchParams.get("threadId");const threadsResult=await state.admin.from("adaptive_ask_threads").select("id,title,created_at,updated_at").eq("user_id",state.user.id).order("updated_at",{ascending:false}).limit(12);if(threadsResult.error)throw threadsResult.error;
    const threads=((threadsResult.data||[]) as Row[]).map(storedThread);const threadId=requested&&threads.some(item=>item.id===requested)?requested:threads[0]?.id||null;let turns:AskSetraStoredTurn[]=[];
    if(threadId){const result=await state.admin.from("adaptive_ask_turns").select("*").eq("user_id",state.user.id).eq("thread_id",threadId).order("created_at").limit(30);if(result.error)throw result.error;turns=((result.data||[]) as Row[]).map(storedTurn)}
    return NextResponse.json({threads,threadId,turns,limits:{perMinute:4,perDay:40,maxQuestionLength:500}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ask Setra could not be loaded."},{status:500})}
}

export async function POST(request:NextRequest){
  if (!adaptiveGenerationEnabled()) return adaptiveGenerationDisabledResponse();
  let state:NonNullable<Awaited<ReturnType<typeof requestState>>>|null=null;let turnId="";
  try{
    state=await requestState();if(!state)return NextResponse.json({error:"Please sign in to use Ask Setra."},{status:401});if(!hasFeature(state.access,"ask_setra_training"))return NextResponse.json({locked:true,requiredPlan:"adaptive"},{status:403});
    const body=await request.json().catch(()=>({})) as {question?:string;threadId?:string|null;clientRequestId?:string};const question=String(body.question||"").trim();const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;if(question.length<3||question.length>500)return NextResponse.json({error:"Ask a question between 3 and 500 characters."},{status:400});if(!body.clientRequestId||!uuid.test(body.clientRequestId))return NextResponse.json({error:"This request could not be identified safely."},{status:400});if(body.threadId&&!uuid.test(body.threadId))return NextResponse.json({error:"That Ask Setra conversation is unavailable."},{status:400});
    const claim=await state.admin.rpc("claim_adaptive_ask_turn",{p_user_id:state.user.id,p_thread_id:body.threadId||null,p_client_request_id:body.clientRequestId,p_question:question});if(claim.error)throw claim.error;const claimed=(Array.isArray(claim.data)?claim.data[0]:claim.data) as Row;turnId=String(claimed.turn_id);const threadId=String(claimed.thread_id);
    if(!claimed.should_generate){const existing=await state.admin.from("adaptive_ask_turns").select("*").eq("user_id",state.user.id).eq("id",turnId).single();if(existing.error)throw existing.error;return NextResponse.json({threadId,turn:storedTurn(existing.data as Row),deduplicated:true},{status:(existing.data as Row).status==="generating"?202:(existing.data as Row).status==="failed"?409:200})}
    const [goalsResult,conversationResult]=await Promise.all([state.auth.rpc("list_athlete_goals",{p_relationship_id:null}),state.admin.from("adaptive_ask_turns").select("question,answer,created_at").eq("user_id",state.user.id).eq("thread_id",threadId).eq("status","ready").neq("id",turnId).order("created_at",{ascending:false}).limit(6)]);if(conversationResult.error)throw conversationResult.error;
    const built=await loadAskSetraContext({admin:state.admin,userId:state.user.id,question,today:state.today,timezone:state.timezone,weekStartsOn:state.weekStartsOn,goals:goalsResult.error?[]:(goalsResult.data||[]),conversation:[...(conversationResult.data||[])].reverse()});const generated=await generateAskSetraAnswer(question,built.context);
    const answer=built.context.selection.medicalConcern&&!generated.answer.safetyNote?{...generated.answer,safetyNote:"Setra can describe your recorded training, but it cannot assess injury or illness. Consider pausing or modifying training and seek appropriate professional advice if symptoms are concerning or persistent."}:generated.answer;const now=new Date().toISOString();
    const update=await state.admin.from("adaptive_ask_turns").update({status:"ready",answer,selected_context:{intents:built.context.selection.intents,links:built.context.availableLinks},context_hash:built.contextHash,model_provider:generated.provider,model_name:generated.model,prompt_version:ASK_SETRA_PROMPT_VERSION,input_tokens:generated.inputTokens,output_tokens:generated.outputTokens,estimated_cost_usd:generated.estimatedCostUsd,error_message:null,completed_at:now}).eq("user_id",state.user.id).eq("id",turnId).select("*").single();if(update.error)throw update.error;await state.admin.from("adaptive_ask_threads").update({updated_at:now}).eq("user_id",state.user.id).eq("id",threadId);
    return NextResponse.json({threadId,turn:storedTurn(update.data as Row)});
  }catch(error){if(state&&turnId)await state.admin.from("adaptive_ask_turns").update({status:"failed",error_message:(error instanceof Error?error.message:"Ask Setra could not answer.").slice(0,500),completed_at:new Date().toISOString()}).eq("user_id",state.user.id).eq("id",turnId);const message=error instanceof Error?error.message:"Ask Setra could not answer that question.";const limited=message.includes("short pause")||message.includes("today's Ask Setra limit");return NextResponse.json({error:message},{status:limited?429:500})}
}

import {NextRequest,NextResponse} from "next/server";
import {loadWeeklyReviewContext} from "@/lib/adaptive/weekly-review-data";
import {getWeeklyReviewProvider} from "@/lib/adaptive/weekly-review-provider";
import {parseWeeklyReviewContent,WEEKLY_REVIEW_PROMPT_VERSION} from "@/lib/adaptive/weekly-review-schema";
import type {StoredWeeklyReview} from "@/lib/adaptive/weekly-review-types";
import {hasFeature,normalizePlan,normalizeRoles} from "@/lib/premium/access";
import {addCalendarDays,weekStartKey,type WeekdayIndex} from "@/lib/setra/week";
import {createAdminClient} from "@/lib/supabase/admin";
import {createClient as createServerClient} from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
const validTimezone=(value:unknown)=>{if(typeof value!=="string"||value.length>80)return "UTC";try{new Intl.DateTimeFormat("en",{timeZone:value}).format();return value}catch{return "UTC"}};
const dateInTimezone=(timezone:string)=>{const parts=new Intl.DateTimeFormat("en",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const part=(type:string)=>parts.find(item=>item.type===type)?.value||"";return `${part("year")}-${part("month")}-${part("day")}`};
const stored=(row:Row):StoredWeeklyReview=>({id:String(row.id),weekStart:String(row.week_start),weekEnd:String(row.week_end),status:row.status,sourceHash:String(row.source_hash),content:row.review?parseWeeklyReviewContent(row.review):null,generatedAt:row.generated_at?String(row.generated_at):null,modelProvider:row.model_provider?String(row.model_provider):null,modelName:row.model_name?String(row.model_name):null,errorMessage:row.error_message?String(row.error_message):null});

async function requestState(){
  const auth=await createServerClient();const {data:{user}}=await auth.auth.getUser();if(!user)return null;
  const admin=createAdminClient();const [profileResult,roleResult]=await Promise.all([admin.from("profiles").select("individual_plan,subscription_tier,timezone,week_starts_on").eq("id",user.id).single(),admin.from("user_roles").select("role").eq("user_id",user.id)]);
  if(profileResult.error)throw profileResult.error;if(roleResult.error&&roleResult.error.code!=="42P01")throw roleResult.error;
  const access={plan:normalizePlan(profileResult.data.individual_plan??profileResult.data.subscription_tier),roles:normalizeRoles((roleResult.data||[]).map((item:Row)=>item.role))};
  const timezone=validTimezone(profileResult.data.timezone),weekStartsOn=(Number(profileResult.data.week_starts_on)||0) as WeekdayIndex,today=dateInTimezone(timezone),targetWeekStart=addCalendarDays(weekStartKey(today,weekStartsOn),-7);
  return {user,auth,admin,access,timezone,weekStartsOn,targetWeekStart};
}

async function loadSource(state:NonNullable<Awaited<ReturnType<typeof requestState>>>,weekStart:string){
  const goals=await state.auth.rpc("list_athlete_goals",{p_relationship_id:null});
  return loadWeeklyReviewContext(state.admin,state.user.id,weekStart,state.timezone,state.weekStartsOn,goals.error?undefined:(goals.data||[]));
}

export async function GET(){
  try{
    const state=await requestState();if(!state)return NextResponse.json({error:"Please sign in to view Adaptive reviews."},{status:401});
    if(!hasFeature(state.access,"ai_weekly_review"))return NextResponse.json({locked:true,requiredPlan:"adaptive"},{status:403});
    const [reviewsResult,source]=await Promise.all([state.admin.from("adaptive_weekly_reviews").select("*").eq("user_id",state.user.id).order("week_start",{ascending:false}).limit(12),loadSource(state,state.targetWeekStart)]);
    if(reviewsResult.error)throw reviewsResult.error;const reviews=((reviewsResult.data||[]) as Row[]).map(stored);const target=reviews.find(item=>item.weekStart===state.targetWeekStart)||null;
    return NextResponse.json({targetWeekStart:state.targetWeekStart,targetWeekEnd:addCalendarDays(state.targetWeekStart,6),sourceHash:source.sourceHash,sourceChanged:Boolean(target&&target.sourceHash!==source.sourceHash),needsGeneration:!target,reviews});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Weekly reviews could not be loaded."},{status:500})}
}

export async function POST(request:NextRequest){
  let claimed=false;let state:Awaited<ReturnType<typeof requestState>>=null;let weekStart="";
  try{
    state=await requestState();if(!state)return NextResponse.json({error:"Please sign in to generate an Adaptive review."},{status:401});
    if(!hasFeature(state.access,"ai_weekly_review"))return NextResponse.json({locked:true,requiredPlan:"adaptive"},{status:403});
    const body=await request.json().catch(()=>({})) as {weekStart?:string;regenerate?:boolean};weekStart=body.weekStart||state.targetWeekStart;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||weekStart>state.targetWeekStart||weekStartKey(weekStart,state.weekStartsOn)!==weekStart)return NextResponse.json({error:"Choose a completed configured training week."},{status:400});
    const source=await loadSource(state,weekStart);
    const existingResult=await state.admin.from("adaptive_weekly_reviews").select("*").eq("user_id",state.user.id).eq("week_start",weekStart).maybeSingle();if(existingResult.error)throw existingResult.error;
    const existing=existingResult.data as Row|null;const force=Boolean(body.regenerate)&&(existing?.source_hash!==source.sourceHash||existing?.status==="failed");
    const claim=await state.admin.rpc("claim_adaptive_weekly_review_generation",{p_user_id:state.user.id,p_week_start:weekStart,p_source_hash:source.sourceHash,p_force:force});if(claim.error)throw claim.error;claimed=Boolean(claim.data);
    if(!claimed){const latest=await state.admin.from("adaptive_weekly_reviews").select("*").eq("user_id",state.user.id).eq("week_start",weekStart).single();if(latest.error)throw latest.error;return NextResponse.json({review:stored(latest.data as Row),deduplicated:true,sourceChanged:(latest.data as Row).source_hash!==source.sourceHash},{status:(latest.data as Row).status==="failed"?409:200})}
    const generated=await getWeeklyReviewProvider().generate(source.context);const now=new Date().toISOString();const update=await state.admin.from("adaptive_weekly_reviews").update({status:"ready",review:generated.content,model_provider:generated.provider,model_name:generated.model,prompt_version:WEEKLY_REVIEW_PROMPT_VERSION,input_tokens:generated.inputTokens,output_tokens:generated.outputTokens,estimated_cost_usd:generated.estimatedCostUsd,generation_count:(Number(existing?.generation_count)||0)+1,error_message:null,generated_at:now}).eq("user_id",state.user.id).eq("week_start",weekStart).select("*").single();if(update.error)throw update.error;
    await state.admin.from("app_notifications").upsert({user_id:state.user.id,category:"training",notification_type:"adaptive_weekly_review",title:"Your weekly review is ready",body:"See what added up and what to carry into the next week.",target_type:"adaptive_weekly_review",target_id:String(update.data.id),target_path:"/?tab=pbs#adaptive-weekly-review",dedupe_key:`adaptive-weekly-review:${weekStart}`,created_at:now,updated_at:now},{onConflict:"user_id,dedupe_key"});
    return NextResponse.json({review:stored(update.data as Row),generated:true});
  }catch(error){
    if(claimed&&state&&weekStart)await state.admin.from("adaptive_weekly_reviews").update({status:"failed",error_message:(error instanceof Error?error.message:"Review generation failed.").slice(0,500)}).eq("user_id",state.user.id).eq("week_start",weekStart);
    return NextResponse.json({error:error instanceof Error?error.message:"The weekly review could not be generated."},{status:500});
  }
}

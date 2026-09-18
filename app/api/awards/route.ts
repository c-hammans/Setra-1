import {NextResponse} from "next/server";
import {createClient as createServerClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {evaluateAwards} from "@/lib/awards/evaluator";
import type {AwardPlanOccurrence,AwardSessionFact,AwardTemplateFact,AwardVolumeFact,StoredAchievement} from "@/lib/awards/types";
import type {TrainingActivityType} from "@/lib/setra/types";
import type {WeekdayIndex} from "@/lib/setra/week";

// Supabase rows are intentionally normalized here so the evaluator remains independent of storage details.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
const validTimezone=(value:unknown)=>{if(typeof value!=="string"||value.length>80)return null;try{new Intl.DateTimeFormat("en",{timeZone:value}).format();return value}catch{return null}};
const dateInTimezone=(timezone:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const localTime=(value:string|undefined,timezone:string)=>value?new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value)):undefined;

export async function POST(request:Request){
  try{
    const auth=await createServerClient();const {data:{user},error:authError}=await auth.auth.getUser();
    if(authError||!user)return NextResponse.json({error:"Please sign in to view awards."},{status:401});
    const body=await request.json().catch(()=>({}));const browserTimezone=validTimezone(body.timezone)||"UTC";const admin=createAdminClient();
    const {data:profile,error:profileError}=await admin.from("profiles").select("week_starts_on,weekly_session_goal,timezone,preferred_unit").eq("id",user.id).single();
    if(profileError)throw profileError;
    const configuredTimezone=validTimezone(profile.timezone);const timezone=configuredTimezone&&configuredTimezone!=="Australia/Melbourne"?configuredTimezone:browserTimezone;
    if(profile.timezone!==timezone){const {error}=await admin.from("profiles").update({timezone}).eq("id",user.id);if(error)throw error}
    const today=dateInTimezone(timezone);
    const {error:usageError}=await admin.from("user_usage_days").upsert({user_id:user.id,local_date:today,timezone},{onConflict:"user_id,local_date"});if(usageError)throw usageError;
    const {error:dueError}=await admin.from("training_plan_occurrences").update({became_due_at:new Date().toISOString()}).eq("user_id",user.id).is("became_due_at",null).lte("planned_date",today).in("status",["planned","skipped"]);if(dueError)throw dueError;
    const [sessionsResult,workoutsResult,strengthTemplatesResult,enduranceTemplatesResult,usageResult,achievementsResult,plansResult]=await Promise.all([
      admin.from("training_sessions").select("id,client_id,modality,activity_type,status,session_date,duration_seconds,distance_metres,started_at,planned_session_id,completed_at").eq("user_id",user.id).order("session_date"),
      admin.from("workouts").select("id,client_id,training_session_id,workout_date,completed_at,workout_templates(client_id),workout_exercises(skipped,load_mode,workout_sets(weight,reps,completed))").eq("user_id",user.id).eq("status","completed").order("workout_date"),
      admin.from("workout_templates").select("id,client_id,created_at").eq("user_id",user.id),
      admin.from("endurance_templates").select("id,client_id,created_at").eq("user_id",user.id),
      admin.from("user_usage_days").select("local_date").eq("user_id",user.id).order("local_date"),
      admin.from("user_achievements").select("achievement_id,earned_at,metadata").eq("user_id",user.id),
      admin.from("training_plan_occurrences").select("occurrence_key,planned_date,modality,status").eq("user_id",user.id).order("planned_date"),
    ]);
    const error=sessionsResult.error||workoutsResult.error||strengthTemplatesResult.error||enduranceTemplatesResult.error||usageResult.error||achievementsResult.error||plansResult.error;if(error)throw error;
    const sessionRows=(sessionsResult.data||[]) as Row[];const workoutRows=(workoutsResult.data||[]) as Row[];const genuineStrengthSessionIds=new Set(workoutRows.filter(row=>(row.workout_exercises||[]).some((exercise:Row)=>!exercise.skipped&&(exercise.workout_sets||[]).some((set:Row)=>set.completed))).map(row=>String(row.training_session_id||"")));const completedRows=sessionRows.filter(row=>row.status==="completed"&&(row.modality!=="strength"||genuineStrengthSessionIds.has(String(row.id))));const plannedClientById=new Map(sessionRows.filter(row=>row.status==="planned").map(row=>[String(row.id),String(row.client_id||row.id)]));
    const sessions=completedRows.map((row):AwardSessionFact=>({id:String(row.client_id||row.id),date:String(row.session_date),modality:row.modality==="strength"?"strength":"endurance",activityType:(row.activity_type||row.modality) as TrainingActivityType|"strength",durationSeconds:row.duration_seconds==null?undefined:Number(row.duration_seconds),distanceMetres:row.distance_metres==null?undefined:Number(row.distance_metres),startedLocalTime:localTime(row.started_at,timezone),plannedSessionId:row.planned_session_id?plannedClientById.get(String(row.planned_session_id)):undefined}));
    const volume=workoutRows.map((row):AwardVolumeFact=>({date:String(row.workout_date),kilograms:(row.workout_exercises||[]).filter((exercise:Row)=>!exercise.skipped&&exercise.load_mode==="kg").flatMap((exercise:Row)=>exercise.workout_sets||[]).filter((set:Row)=>set.completed).reduce((total:number,set:Row)=>total+(Number(set.weight)||0)*(Number.parseFloat(String(set.reps))||0),0)}));
    const templateRow=(modality:"strength"|"endurance")=>(row:Row):AwardTemplateFact=>({id:String(row.client_id||row.id),createdDate:String(row.created_at).slice(0,10),modality});
    const templates=[...((strengthTemplatesResult.data||[]) as Row[]).map(templateRow("strength")),...((enduranceTemplatesResult.data||[]) as Row[]).map(templateRow("endurance"))];
    const stored=((achievementsResult.data||[]) as Row[]).map((row):StoredAchievement=>({achievementId:String(row.achievement_id),earnedAt:String(row.earned_at),metadata:row.metadata&&typeof row.metadata==="object"?row.metadata:{}}));
    const plans=((plansResult.data||[]) as Row[]).map((row):AwardPlanOccurrence=>({key:String(row.occurrence_key),date:String(row.planned_date),modality:row.modality==="strength"?"strength":"endurance",status:row.status}));
    const planByKey=new Map(plans.map(item=>[item.key,item]));const completions:{key:string;clientId:string;completedAt:string}[]=[];
    for(const row of workoutRows){if(!genuineStrengthSessionIds.has(String(row.training_session_id||"")))continue;const linked=Array.isArray(row.workout_templates)?row.workout_templates[0]:row.workout_templates;if(linked?.client_id)completions.push({key:`strength:${linked.client_id}:${row.workout_date}`,clientId:String(row.client_id||row.id),completedAt:String(row.completed_at||new Date().toISOString())})}
    for(const row of completedRows){if(row.modality!=="endurance"||!row.planned_session_id)continue;const plannedClientId=plannedClientById.get(String(row.planned_session_id));if(plannedClientId)completions.push({key:`endurance:${plannedClientId}`,clientId:String(row.client_id||row.id),completedAt:String(row.completed_at||new Date().toISOString())})}
    for(const completion of completions){const plan=planByKey.get(completion.key);if(!plan||plan.status==="completed")continue;plan.status="completed";await admin.from("training_plan_occurrences").update({status:"completed",linked_completion_client_id:completion.clientId,completed_at:completion.completedAt}).eq("user_id",user.id).eq("occurrence_key",completion.key)}
    const evaluation=evaluateAwards({today,timezone,weekStartsOn:(Number(profile.week_starts_on)||0) as WeekdayIndex,weeklySessionGoal:profile.weekly_session_goal==null?null:Number(profile.weekly_session_goal),sessions,volume,templates,usageDays:(usageResult.data||[]).map(row=>String(row.local_date)),planOccurrences:plans,stored});
    if(evaluation.newlyEarned.length){const {error:awardError}=await admin.from("user_achievements").upsert(evaluation.newlyEarned.map(item=>({user_id:user.id,achievement_id:item.achievementId,earned_at:item.earnedAt,metadata:item.metadata})),{onConflict:"user_id,achievement_id",ignoreDuplicates:true});if(awardError)throw awardError}
    return NextResponse.json({...evaluation,timezone,weekStartsOn:Number(profile.week_starts_on)||0,weeklySessionGoal:profile.weekly_session_goal==null?null:Number(profile.weekly_session_goal),preferredUnit:profile.preferred_unit==="lb"?"lb":"kg"});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Awards could not be evaluated."},{status:500})}
}

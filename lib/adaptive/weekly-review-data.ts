import "server-only";
import {addCalendarDays} from "@/lib/setra/week";
import {buildWeeklyReviewContext,weeklyReviewSourceHash} from "./weekly-review-context";
import type {WeeklyReviewContext} from "./weekly-review-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient=any;

export async function loadWeeklyReviewContext(admin:AdminClient,userId:string,weekStart:string,timezone:string,weekStartsOn:number,goalRows?:Record<string,unknown>[]):Promise<{context:WeeklyReviewContext;sourceHash:string}>{
  const rangeStart=addCalendarDays(weekStart,-28),rangeEnd=addCalendarDays(weekStart,6);
  const [occurrencesResult,sessionsResult,workoutsResult,goalsResult,programsResult,pbsResult]=await Promise.all([
    admin.from("training_plan_occurrences").select("planned_date,status,modality,source_client_id,linked_completion_client_id,updated_at").eq("user_id",userId).gte("planned_date",rangeStart).lte("planned_date",rangeEnd).order("planned_date"),
    admin.from("training_sessions").select("id,client_id,modality,activity_type,status,session_date,duration_seconds,distance_metres,average_pace_seconds_per_km,average_speed_kph,average_heart_rate,elevation_gain_metres,completed_rpe,updated_at").eq("user_id",userId).gte("session_date",rangeStart).lte("session_date",rangeEnd).order("session_date"),
    admin.from("workouts").select("id,client_id,workout_date,updated_at,workout_exercises(skipped,load_mode,exercises(name),workout_sets(weight,reps,rpe,completed))").eq("user_id",userId).eq("status","completed").gte("workout_date",rangeStart).lte("workout_date",rangeEnd).order("workout_date"),
    admin.from("athlete_goals").select("title,goal_type,target_date,metric_type,target_value,target_unit,target_label,target_distance_metres,is_primary,status,approval_status,updated_at").eq("client_user_id",userId).eq("status","active").order("is_primary",{ascending:false}),
    admin.from("client_programs").select("name,focus,duration_weeks,start_date,end_date,status,created_at,ended_at").eq("client_user_id",userId).in("status",["active","completed"]).lte("start_date",rangeEnd).gte("end_date",rangeStart).order("start_date",{ascending:false}),
    admin.rpc("get_adaptive_weekly_personal_bests",{p_user_id:userId,p_week_start:weekStart}),
  ]);
  const error=occurrencesResult.error||sessionsResult.error||workoutsResult.error||goalsResult.error||programsResult.error||pbsResult.error;if(error)throw error;
  const sessionIds=(sessionsResult.data||[]).map((row:Record<string,unknown>)=>String(row.client_id||row.id));
  let checkIns:Record<string,unknown>[]=[];
  if(sessionIds.length){const result=await admin.from("athlete_session_checkins").select("completed_client_id,session_rpe,session_feel,athlete_comment,updated_at").eq("user_id",userId).in("completed_client_id",sessionIds.slice(0,500));if(result.error)throw result.error;checkIns=result.data||[]}
  const context=buildWeeklyReviewContext({timezone,weekStartsOn,weekStart,occurrences:occurrencesResult.data||[],sessions:sessionsResult.data||[],workouts:workoutsResult.data||[],checkIns,goals:goalRows||goalsResult.data||[],programs:programsResult.data||[],personalBests:Array.isArray(pbsResult.data)?pbsResult.data:[]});
  return {context,sourceHash:weeklyReviewSourceHash(context)};
}

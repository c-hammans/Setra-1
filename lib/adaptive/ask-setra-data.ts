import "server-only";
import {addCalendarDays,weekStartKey,type WeekdayIndex} from "@/lib/setra/week";
import {buildAskSetraContext} from "./ask-setra-context";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient=any;

export async function loadAskSetraContext({admin,userId,question,today,timezone,weekStartsOn,goals,conversation}:{admin:AdminClient;userId:string;question:string;today:string;timezone:string;weekStartsOn:WeekdayIndex;goals:Record<string,unknown>[];conversation:Record<string,unknown>[]}){
  const currentWeek=weekStartKey(today,weekStartsOn),rangeStart=addCalendarDays(currentWeek,-77),rangeEnd=addCalendarDays(today,14);
  const [occurrences,sessions,workouts,programs,reviews,personalBests]=await Promise.all([
    admin.from("training_plan_occurrences").select("planned_date,status,modality,source_client_id,linked_completion_client_id,updated_at").eq("user_id",userId).gte("planned_date",rangeStart).lte("planned_date",rangeEnd).order("planned_date"),
    admin.from("training_sessions").select("id,client_id,modality,activity_type,status,title,session_date,planned_start_time,planned_duration_minutes,planned_distance_metres,duration_seconds,distance_metres,average_pace_seconds_per_km,average_speed_kph,average_heart_rate,elevation_gain_metres,completed_rpe,updated_at").eq("user_id",userId).gte("session_date",rangeStart).lte("session_date",rangeEnd).order("session_date"),
    admin.from("workouts").select("id,client_id,name,workout_date,updated_at,workout_exercises(skipped,load_mode,exercises(name),workout_sets(weight,reps,rpe,completed))").eq("user_id",userId).eq("status","completed").gte("workout_date",rangeStart).lte("workout_date",today).order("workout_date"),
    admin.from("client_programs").select("name,focus,duration_weeks,start_date,end_date,status,created_at,ended_at").eq("client_user_id",userId).in("status",["active","completed"]).lte("start_date",rangeEnd).gte("end_date",rangeStart).order("start_date",{ascending:false}),
    admin.from("adaptive_weekly_reviews").select("week_start,week_end,review,generated_at").eq("user_id",userId).eq("status","ready").order("week_start",{ascending:false}).limit(4),
    admin.rpc("get_adaptive_training_bests",{p_user_id:userId}),
  ]);
  const error=occurrences.error||sessions.error||workouts.error||programs.error||reviews.error||personalBests.error;if(error)throw error;
  const sessionIds=(sessions.data||[]).map((row:Record<string,unknown>)=>String(row.client_id||row.id));let checkIns:Record<string,unknown>[]=[];
  if(sessionIds.length){const result=await admin.from("athlete_session_checkins").select("completed_client_id,session_rpe,session_feel,athlete_comment,updated_at").eq("user_id",userId).in("completed_client_id",sessionIds.slice(0,500)).order("updated_at",{ascending:false});if(result.error)throw result.error;checkIns=result.data||[]}
  return buildAskSetraContext({question,today,timezone,weekStartsOn,occurrences:occurrences.data||[],sessions:sessions.data||[],workouts:workouts.data||[],checkIns,goals,personalBests:Array.isArray(personalBests.data)?personalBests.data:[],programs:programs.data||[],reviews:reviews.data||[],conversation});
}

import "server-only";
import {addCalendarDays,weekStartKey,type WeekdayIndex} from "@/lib/setra/week";
import {loadAskSetraContext} from "./ask-setra-data";
import {loadWeeklyReviewContext} from "./weekly-review-data";
import type {RecommendationSource} from "./recommendation-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client=any;

export async function loadRecommendationSource({admin,auth,userId,today,timezone,weekStartsOn}:{admin:Client;auth:Client;userId:string;today:string;timezone:string;weekStartsOn:WeekdayIndex}):Promise<RecommendationSource>{
  const goalsResult=await auth.rpc("list_athlete_goals",{p_relationship_id:null});const goalRows=(goalsResult.error?[]:goalsResult.data||[]) as Array<Record<string,unknown>>;
  const completedWeekStart=addCalendarDays(weekStartKey(today,weekStartsOn),-7);
  const [ask,weekly]=await Promise.all([
    loadAskSetraContext({admin,userId,question:"Review strength, endurance, goals, schedule, session RPE and feel for proactive training recommendations.",today,timezone,weekStartsOn,goals:goalRows,conversation:[]}),
    loadWeeklyReviewContext(admin,userId,completedWeekStart,timezone,weekStartsOn,goalRows),
  ]);
  return {today,weekly:weekly.context,askContext:ask.context,goalRows};
}

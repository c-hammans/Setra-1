import {achievementDefinitions} from "./definitions.ts";
import type {AwardEvaluation,AwardEvaluationInput,AwardMetric,StoredAchievement,StreakSummary} from "./types.ts";
import {localDateKey,parseLocalDate,weekStartKey} from "../setra/week.ts";

const addDays=(key:string,days:number)=>{const date=parseLocalDate(key);date.setDate(date.getDate()+days);return localDateKey(date)};
const distinct=(values:string[])=>[...new Set(values)].sort();
const sequences=(keys:string[],step:(key:string)=>string)=>{const set=new Set(keys);let longest=0;for(const key of keys){if(set.has(step(key)))continue;let length=1,cursor=key;while(set.has(cursor=step(cursor)))length++;longest=Math.max(longest,length)}return longest};
const streakForDates=(keys:string[],today:string):StreakSummary=>{const values=distinct(keys),set=new Set(values);let end=set.has(today)?today:addDays(today,-1),current=0;while(set.has(end)){current++;end=addDays(end,-1)}return{current,longest:sequences(values,key=>addDays(key,1))}};
const weekStreak=(successful:string[],currentWeek:string,includeCurrentIfMissing:boolean):StreakSummary=>{const values=distinct(successful),set=new Set(values);let end=set.has(currentWeek)?currentWeek:includeCurrentIfMissing?addDays(currentWeek,-7):currentWeek,current=0;while(set.has(end)){current++;end=addDays(end,-7)}return{current,longest:sequences(values,key=>addDays(key,7))}};
const sum=(values:number[])=>values.reduce((total,value)=>total+value,0);
const clockDate=(date:string)=>`${date}T12:00:00.000Z`;

export function evaluateAwards(input:AwardEvaluationInput):AwardEvaluation{
  const sessions=[...input.sessions].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const dates=distinct(sessions.map(item=>item.date));
  const trainingDays=streakForDates(dates,input.today);
  const currentWeek=weekStartKey(input.today,input.weekStartsOn);
  const sessionsByWeek=new Map<string,typeof sessions>();
  for(const session of sessions){const key=weekStartKey(session.date,input.weekStartsOn);sessionsByWeek.set(key,[...(sessionsByWeek.get(key)||[]),session])}
  const activeWeekKeys=distinct([...sessionsByWeek.keys()]);
  const activeWeeks=weekStreak(activeWeekKeys,currentWeek,true);
  const goalWeekKeys=input.weeklySessionGoal?activeWeekKeys.filter(key=>(sessionsByWeek.get(key)?.length||0)>=input.weeklySessionGoal!):[];
  const weeklyGoal=weekStreak(goalWeekKeys,currentWeek,true);
  const closedPlans=input.planOccurrences.filter(item=>weekStartKey(item.date,input.weekStartsOn)<currentWeek&&item.status!=="cancelled"&&item.status!=="rescheduled");
  const plansByWeek=new Map<string,typeof closedPlans>();
  for(const item of closedPlans){const key=weekStartKey(item.date,input.weekStartsOn);plansByWeek.set(key,[...(plansByWeek.get(key)||[]),item])}
  const plannedWeekKeys=distinct([...plansByWeek].filter(([,items])=>items.length>0&&items.every(item=>item.status==="completed")).map(([key])=>key));
  const plannedWeeks=weekStreak(plannedWeekKeys,currentWeek,true);
  const setraUse=streakForDates(input.usageDays,input.today);
  const hybridWeekKeys=activeWeekKeys.filter(key=>{const items=sessionsByWeek.get(key)||[];return items.some(item=>item.modality==="strength")&&items.some(item=>item.modality==="endurance")});
  const distanceKm=(activities:string[])=>sum(sessions.filter(item=>activities.includes(item.activityType)).map(item=>(item.distanceMetres||0)/1000));
  const dayCounts=new Map<string,number>();sessions.forEach(item=>dayCounts.set(item.date,(dayCounts.get(item.date)||0)+1));
  const gaps=sessions.slice(1).map((item,index)=>(parseLocalDate(item.date).getTime()-parseLocalDate(sessions[index].date).getTime())/86400000);
  const values:Record<AwardMetric,number>={
    sessions_completed:sessions.length,training_day_streak:trainingDays.longest,active_week_streak:activeWeeks.longest,weekly_goal_streak:weeklyGoal.longest,
    planned_week_streak:plannedWeeks.longest,setra_use_streak:setraUse.longest,training_hours:sum(sessions.map(item=>item.durationSeconds||0))/3600,
    run_distance_km:distanceKm(["run"]),bike_distance_km:distanceKm(["bike"]),swim_distance_km:distanceKm(["swim"]),row_distance_km:distanceKm(["row"]),walk_distance_km:distanceKm(["walk_hike"]),
    strength_volume_kg:sum(input.volume.map(item=>item.kilograms)),hybrid_weeks:hybridWeekKeys.length,first_strength:sessions.some(item=>item.modality==="strength")?1:0,
    first_endurance:sessions.some(item=>item.modality==="endurance")?1:0,first_planned_completion:sessions.some(item=>Boolean(item.plannedSessionId))||input.planOccurrences.some(item=>item.status==="completed")?1:0,
    templates_created:input.templates.length,early_sessions:sessions.filter(item=>item.startedLocalTime&&item.startedLocalTime<"07:00").length,
    late_sessions:sessions.filter(item=>item.startedLocalTime&&item.startedLocalTime>="21:00").length,weekends_trained:new Set(sessions.filter(item=>[0,6].includes(parseLocalDate(item.date).getDay())).map(item=>item.date)).size,
    activity_variety:new Set(sessions.map(item=>item.activityType)).size,double_days:[...dayCounts.values()].filter(value=>value>=2).length,back_at_it:gaps.some(days=>days>=21)?1:0,
    first_full_planned_week:plannedWeekKeys.length?1:0,
  };
  // The hidden First Light badge uses the same count metric but a stricter time check.
  const hasBeforeDawn=sessions.some(item=>item.startedLocalTime&&item.startedLocalTime<"05:30");
  const storedById=new Map(input.stored.map(item=>[item.achievementId,item]));
  const newlyEarned:StoredAchievement[]=[];
  const awards=achievementDefinitions.map(definition=>{
    const stored=storedById.get(definition.id);const value=definition.id==="secret_before_dawn"?(hasBeforeDawn?1:0):values[definition.metric];const earned=Boolean(stored)||value>=definition.threshold;
    let earnedAt=stored?.earnedAt;
    if(earned&&!stored){
      const evidenceDate=definition.metric==="sessions_completed"?sessions[Math.min(definition.threshold,sessions.length)-1]?.date:
        definition.metric==="first_strength"?sessions.find(item=>item.modality==="strength")?.date:
        definition.metric==="first_endurance"?sessions.find(item=>item.modality==="endurance")?.date:
        definition.metric==="templates_created"?input.templates[Math.min(definition.threshold,input.templates.length)-1]?.createdDate:
        definition.metric==="setra_use_streak"?input.usageDays.at(-1):sessions.at(-1)?.date||input.today;
      earnedAt=clockDate(evidenceDate||input.today);
      newlyEarned.push({achievementId:definition.id,earnedAt,metadata:{value,threshold:definition.threshold,weekStartsOn:input.weekStartsOn,timezone:input.timezone}});
    }
    return{definition,earned,earnedAt,value,threshold:definition.threshold,progress:Math.min(1,value/definition.threshold),metadata:stored?.metadata};
  });
  return{awards,streaks:{trainingDays,activeWeeks,weeklyGoal,plannedWeeks,setraUse},newlyEarned,metrics:values};
}

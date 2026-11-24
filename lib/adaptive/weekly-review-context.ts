import {createHash} from "node:crypto";
import {addCalendarDays} from "../setra/week.ts";
import type {WeeklyReviewContext,WeeklyReviewMetricPeriod} from "./weekly-review-types";

// Storage rows are normalized here so the context sent to an AI provider stays compact.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;

export type WeeklyReviewSource={
  timezone:string;weekStartsOn:number;weekStart:string;
  occurrences:Row[];sessions:Row[];workouts:Row[];checkIns:Row[];goals:Row[];programs:Row[];personalBests?:Row[];
};

const number=(value:unknown)=>Number.isFinite(Number(value))?Number(value):0;
const reps=(value:unknown)=>{const parsed=Number.parseFloat(String(value??""));return Number.isFinite(parsed)?parsed:0};
const inRange=(value:unknown,start:string,end:string)=>String(value)>=start&&String(value)<=end;
const round=(value:number,digits=1)=>Number(value.toFixed(digits));

function period(source:WeeklyReviewSource,weekStart:string):WeeklyReviewMetricPeriod{
  const end=addCalendarDays(weekStart,6);
  const occurrences=source.occurrences.filter(row=>inRange(row.planned_date,weekStart,end));
  const planned=occurrences.filter(row=>!["cancelled","rescheduled"].includes(String(row.status))).length;
  const completed=occurrences.filter(row=>["completed","partial"].includes(String(row.status))).length;
  const sessions=source.sessions.filter(row=>row.status==="completed"&&inRange(row.session_date,weekStart,end));
  const strengthSessions=sessions.filter(row=>row.modality==="strength").length;
  const endurance=sessions.filter(row=>row.modality==="endurance");
  const workouts=source.workouts.filter(row=>inRange(row.workout_date,weekStart,end));
  let strengthSets=0;let strengthVolumeKg=0;
  for(const workout of workouts)for(const exercise of workout.workout_exercises||[]){if(exercise.skipped)continue;for(const set of exercise.workout_sets||[]){if(!set.completed)continue;strengthSets++;if(exercise.load_mode==="kg")strengthVolumeKg+=number(set.weight)*reps(set.reps)}}
  const durationRows=sessions.filter(row=>row.duration_seconds!=null);
  const activityMix:Record<string,number>={};const sportMetrics:WeeklyReviewMetricPeriod["sportMetrics"]={};for(const session of endurance){const key=String(session.activity_type||"endurance");activityMix[key]=(activityMix[key]||0)+1;const related=endurance.filter(row=>String(row.activity_type||"endurance")===key);const known=(field:string)=>related.filter(row=>row[field]!=null);const avg=(field:string)=>{const rows=known(field);return rows.length?round(rows.reduce((sum,row)=>sum+number(row[field]),0)/rows.length):null};sportMetrics[key]={sessions:related.length,distanceKm:round(related.reduce((sum,row)=>sum+number(row.distance_metres),0)/1000),durationMinutes:known("duration_seconds").length?round(known("duration_seconds").reduce((sum,row)=>sum+number(row.duration_seconds),0)/60):null,averagePaceSecondsPerKm:avg("average_pace_seconds_per_km"),averageSpeedKph:avg("average_speed_kph"),elevationMetres:known("elevation_gain_metres").length?round(known("elevation_gain_metres").reduce((sum,row)=>sum+number(row.elevation_gain_metres),0)):null,averageHeartRate:avg("average_heart_rate")}}
  return {weekStart,planned,completed,skipped:occurrences.filter(row=>row.status==="skipped").length,rescheduled:occurrences.filter(row=>row.status==="rescheduled").length,adherencePercent:planned?Math.round(completed/planned*100):null,totalSessions:sessions.length,durationMinutes:durationRows.length?Math.round(durationRows.reduce((sum,row)=>sum+number(row.duration_seconds),0)/60):null,strengthSessions,enduranceSessions:endurance.length,strengthSets,strengthVolumeKg:round(strengthVolumeKg),enduranceDistanceKm:round(endurance.reduce((sum,row)=>sum+number(row.distance_metres),0)/1000),activityMix,sportMetrics};
}

function average(periods:WeeklyReviewMetricPeriod[]){
  if(!periods.length)return null;const count=periods.length;const mix:Record<string,number>={};for(const item of periods)for(const [key,value] of Object.entries(item.activityMix))mix[key]=(mix[key]||0)+value/count;
  return {planned:round(periods.reduce((s,p)=>s+p.planned,0)/count),completed:round(periods.reduce((s,p)=>s+p.completed,0)/count),skipped:round(periods.reduce((s,p)=>s+p.skipped,0)/count),rescheduled:round(periods.reduce((s,p)=>s+p.rescheduled,0)/count),adherencePercent:periods.some(p=>p.adherencePercent!=null)?round(periods.reduce((s,p)=>s+(p.adherencePercent||0),0)/periods.filter(p=>p.adherencePercent!=null).length):null,totalSessions:round(periods.reduce((s,p)=>s+p.totalSessions,0)/count),durationMinutes:periods.some(p=>p.durationMinutes!=null)?round(periods.reduce((s,p)=>s+(p.durationMinutes||0),0)/periods.filter(p=>p.durationMinutes!=null).length):null,strengthSessions:round(periods.reduce((s,p)=>s+p.strengthSessions,0)/count),enduranceSessions:round(periods.reduce((s,p)=>s+p.enduranceSessions,0)/count),strengthSets:round(periods.reduce((s,p)=>s+p.strengthSets,0)/count),strengthVolumeKg:round(periods.reduce((s,p)=>s+p.strengthVolumeKg,0)/count),enduranceDistanceKm:round(periods.reduce((s,p)=>s+p.enduranceDistanceKm,0)/count),activityMix:Object.fromEntries(Object.entries(mix).map(([key,value])=>[key,round(value)])),sportMetrics:{}};
}

function goalCurrentValue(goal:Row,source:WeeklyReviewSource){
  if(goal.current_value!=null)return number(goal.current_value);
  if(goal.metric_type==="strength_load"){
    const target=String(goal.target_label||"").trim().toLowerCase();let best:number|null=null;
    for(const workout of source.workouts)for(const exercise of workout.workout_exercises||[]){const linked=Array.isArray(exercise.exercises)?exercise.exercises[0]:exercise.exercises;if(exercise.skipped||String(linked?.name||"").trim().toLowerCase()!==target)continue;for(const set of exercise.workout_sets||[])if(set.completed&&set.weight!=null)best=Math.max(best??0,number(set.weight))}
    return best;
  }
  const matches=source.sessions.filter(row=>row.status==="completed"&&row.modality==="endurance"&&((goal.goal_type==="running"&&row.activity_type==="run")||(goal.goal_type==="cycling"&&row.activity_type==="bike")||(goal.goal_type==="swimming"&&row.activity_type==="swim")||(goal.goal_type==="rowing"&&row.activity_type==="row")));
  if(goal.metric_type==="event_time"&&goal.target_distance_metres){const target=number(goal.target_distance_metres);const values=matches.filter(row=>row.duration_seconds!=null&&number(row.distance_metres)>=target*.98&&number(row.distance_metres)<=target*1.02).map(row=>number(row.duration_seconds));return values.length?Math.min(...values):null}
  if(goal.metric_type==="distance"){const values=matches.map(row=>number(row.distance_metres)).filter(Boolean);return values.length?Math.max(...values):null}
  return null;
}

export function buildWeeklyReviewContext(source:WeeklyReviewSource):WeeklyReviewContext{
  const current=period(source,source.weekStart);const prior=Array.from({length:4},(_,index)=>period(source,addCalendarDays(source.weekStart,-7*(index+1))));
  const start=source.weekStart,end=addCalendarDays(start,6);const targetSessions=source.sessions.filter(row=>row.status==="completed"&&inRange(row.session_date,start,end));const clientIds=new Set(targetSessions.map(row=>String(row.client_id||row.id)));
  const checkIns=source.checkIns.filter(row=>clientIds.has(String(row.completed_client_id))).slice(0,12).map(row=>({rpe:row.session_rpe==null?null:number(row.session_rpe),feel:row.session_feel?String(row.session_feel):null,comment:row.athlete_comment?String(row.athlete_comment).slice(0,300):null}));
  const activeProgram=source.programs.find(row=>row.status==="active"&&String(row.start_date)<=end&&String(row.end_date)>=start);const gaps:string[]=[];
  if(current.durationMinutes==null&&current.totalSessions)gaps.push("Some completed sessions do not have reliable duration data.");
  if(!checkIns.length)gaps.push("No athlete session check-ins were recorded for this week.");
  if(!source.personalBests?.length)gaps.push("No verified personal-best event was recorded for this week.");
  const context:WeeklyReviewContext={schemaVersion:"weekly-review-context-v1",week:{start,end,timezone:source.timezone,weekStartsOn:source.weekStartsOn},current,previous:prior[0],priorFourWeekAverage:average(prior),checkIns,goals:source.goals.filter(row=>row.status==="active"&&row.approval_status!=="proposed").slice(0,8).map(row=>({title:String(row.title),type:String(row.goal_type),targetDate:row.target_date?String(row.target_date):null,primary:Boolean(row.is_primary),currentValue:goalCurrentValue(row,source),targetValue:row.target_value==null?null:number(row.target_value),unit:row.target_unit?String(row.target_unit):null})),activeProgram:activeProgram?{name:String(activeProgram.name),focus:activeProgram.focus?String(activeProgram.focus).slice(0,240):null,currentWeek:Math.max(1,Math.min(number(activeProgram.duration_weeks),Math.floor((new Date(`${start}T12:00:00`).getTime()-new Date(`${activeProgram.start_date}T12:00:00`).getTime())/604800000)+1)),durationWeeks:number(activeProgram.duration_weeks)}:null,personalBests:(source.personalBests||[]).slice(0,12).map(row=>({label:String(row.label),result:String(row.result)})),dataGaps:gaps};
  return context;
}

function canonical(value:unknown):string{if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;if(value&&typeof value==="object")return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;return JSON.stringify(value)}
export const weeklyReviewSourceHash=(context:WeeklyReviewContext)=>createHash("sha256").update(canonical(context)).digest("hex");

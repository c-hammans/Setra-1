import type {EnduranceSession,Exercise,TrainingActivityType,Workout} from "../setra/types.ts";
import {addCalendarDays,weekStartKey,type WeekdayIndex} from "../setra/week.ts";

export type AnalyticsRange="4w"|"12w"|"6m"|"1y"|"all";
export type AnalyticsBucket={key:string;label:string;sessions:number;strengthSessions:number;enduranceSessions:number;strengthVolumeKg:number;sets:number;distanceKm:number;durationMinutes:number;elevationMetres:number;heartRateAverage?:number};
export type AnalyticsComparison={current:number;previous:number;changePercent?:number};
export type ExerciseAnalytics={exerciseId:string;name:string;sessions:number;sets:number;volumeKg:number;firstMaxLoadKg?:number;lastMaxLoadKg?:number;loadChangeKg?:number};
export type ActivityAnalytics={activityType:TrainingActivityType;sessions:number;distanceKm:number;durationMinutes:number;elevationMetres:number;averageHeartRate?:number;latestPerformance?:number;firstPerformance?:number;performanceKind?:"pace"|"speed"|"split"};
export type TrainingAnalytics={
  range:AnalyticsRange;
  period:{start:string;end:string;bucket:"week"|"month"|"year"};
  buckets:AnalyticsBucket[];
  totalSessions:number;
  strengthSessions:number;
  enduranceSessions:number;
  durationMinutes:number;
  durationCoverage:number;
  strengthVolumeKg:number;
  strengthSets:number;
  enduranceDistanceKm:number;
  elevationMetres:number;
  heartRateAverage?:number;
  exerciseFrequency:ExerciseAnalytics[];
  topExercisesByVolume:ExerciseAnalytics[];
  loadProgression:ExerciseAnalytics[];
  repRanges:Array<{label:string;count:number}>;
  activities:ActivityAnalytics[];
  comparison:{sessions:AnalyticsComparison;duration:AnalyticsComparison;volume:AnalyticsComparison;sets:AnalyticsComparison;distance:AnalyticsComparison};
};

type Input={workouts:Workout[];enduranceSessions:EnduranceSession[];exercises:Exercise[];range:AnalyticsRange;today:string;weekStartsOn:WeekdayIndex};
type StrengthRecord={date:string;duration?:number;volumeKg:number;sets:number;exerciseRows:Array<{exerciseId:string;sets:number;volumeKg:number;maxLoadKg?:number;reps:number[]}>};

const completedStrength=(workout:Workout):StrengthRecord|null=>{
  const exerciseRows=workout.exercises.flatMap(exercise=>{
    if(exercise.skipped)return[];
    const sets=exercise.sets.filter(set=>set.done);
    if(!sets.length)return[];
    const numericReps=sets.map(set=>Number(set.reps)).filter(value=>Number.isFinite(value)&&value>0);
    const weighted=exercise.loadMode==null||exercise.loadMode==="kg"?sets.filter(set=>Number(set.weight)>0&&Number(set.reps)>0):[];
    const loads=weighted.map(set=>Number(set.weight));
    return[{exerciseId:exercise.exerciseId,sets:sets.length,volumeKg:weighted.reduce((sum,set)=>sum+Number(set.weight)*Number(set.reps),0),maxLoadKg:loads.length?Math.max(...loads):undefined,reps:numericReps}];
  });
  if(!exerciseRows.length)return null;
  return{date:workout.date,duration:workout.duration>0?workout.duration:undefined,volumeKg:exerciseRows.reduce((sum,row)=>sum+row.volumeKg,0),sets:exerciseRows.reduce((sum,row)=>sum+row.sets,0),exerciseRows};
};

const rangeDays:Record<Exclude<AnalyticsRange,"all">,number>={"4w":28,"12w":84,"6m":183,"1y":365};
const valueComparison=(current:number,previous:number):AnalyticsComparison=>({current,previous,changePercent:previous>0?((current-previous)/previous)*100:undefined});
const inPeriod=(date:string,start:string,end:string)=>date>=start&&date<=end;
const monthLabel=(key:string)=>new Intl.DateTimeFormat("en-AU",{month:"short",year:"2-digit"}).format(new Date(`${key}-15T12:00:00`));
const weekLabel=(key:string)=>new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(new Date(`${key}T12:00:00`));
const activityPerformance=(session:EnduranceSession)=>{
  if(session.activityType==="bike"||session.activityType==="elliptical"||session.activityType==="cross_training")return session.averageSpeedKph?{value:session.averageSpeedKph,kind:"speed" as const}:null;
  if(session.activityType==="row")return session.averageSplitSecondsPer500m?{value:session.averageSplitSecondsPer500m,kind:"split" as const}:null;
  return session.averagePaceSecondsPerKm?{value:session.averagePaceSecondsPerKm,kind:"pace" as const}:null;
};

export function buildTrainingAnalytics({workouts,enduranceSessions,exercises,range,today,weekStartsOn}:Input):TrainingAnalytics{
  const strength=workouts.map(completedStrength).filter((row):row is StrengthRecord=>Boolean(row));
  const endurance=enduranceSessions.filter(session=>session.status==="completed");
  const allDates=[...strength.map(row=>row.date),...endurance.map(row=>row.date)].sort();
  const defaultStart=range==="all"?(allDates[0]||today):addCalendarDays(today,-(rangeDays[range]-1));
  const start=defaultStart>today?today:defaultStart;
  const spanDays=range==="all"?Math.max(1,Math.round((new Date(`${today}T12:00:00`).getTime()-new Date(`${start}T12:00:00`).getTime())/86400000)+1):rangeDays[range];
  const bucket:TrainingAnalytics["period"]["bucket"]=range==="4w"||range==="12w"?"week":range==="all"&&spanDays>730?"year":"month";
  const currentStrength=strength.filter(row=>inPeriod(row.date,start,today));
  const currentEndurance=endurance.filter(row=>inPeriod(row.date,start,today));
  const previousEnd=addCalendarDays(start,-1);
  const previousStart=addCalendarDays(previousEnd,-(spanDays-1));
  const previousStrength=range==="all"?[]:strength.filter(row=>inPeriod(row.date,previousStart,previousEnd));
  const previousEndurance=range==="all"?[]:endurance.filter(row=>inPeriod(row.date,previousStart,previousEnd));
  const exerciseNames=new Map(exercises.map(exercise=>[exercise.id,exercise.name]));

  const exerciseMap=new Map<string,ExerciseAnalytics&{loads:Array<{date:string;value:number}>;reps:number[]}>();
  currentStrength.forEach(workout=>workout.exerciseRows.forEach(row=>{
    const current=exerciseMap.get(row.exerciseId)||{exerciseId:row.exerciseId,name:exerciseNames.get(row.exerciseId)||"Unknown exercise",sessions:0,sets:0,volumeKg:0,loads:[],reps:[]};
    current.sessions+=1;current.sets+=row.sets;current.volumeKg+=row.volumeKg;current.reps.push(...row.reps);if(row.maxLoadKg)current.loads.push({date:workout.date,value:row.maxLoadKg});exerciseMap.set(row.exerciseId,current);
  }));
  const exerciseRows=[...exerciseMap.values()].map(row=>{const loads=row.loads.sort((a,b)=>a.date.localeCompare(b.date));return{exerciseId:row.exerciseId,name:row.name,sessions:row.sessions,sets:row.sets,volumeKg:row.volumeKg,firstMaxLoadKg:loads[0]?.value,lastMaxLoadKg:loads.at(-1)?.value,loadChangeKg:loads.length>1?loads.at(-1)!.value-loads[0].value:undefined};});
  const allReps=[...exerciseMap.values()].flatMap(row=>row.reps);
  const repRanges=[{label:"1–5",count:allReps.filter(value=>value<=5).length},{label:"6–8",count:allReps.filter(value=>value>=6&&value<=8).length},{label:"9–12",count:allReps.filter(value=>value>=9&&value<=12).length},{label:"13–20",count:allReps.filter(value=>value>=13&&value<=20).length},{label:"21+",count:allReps.filter(value=>value>=21).length}];

  const activityTypes=[...new Set(currentEndurance.map(session=>session.activityType))];
  const activities=activityTypes.map(activityType=>{const rows=currentEndurance.filter(session=>session.activityType===activityType).sort((a,b)=>a.date.localeCompare(b.date));const hr=rows.map(row=>row.averageHeartRate).filter((value):value is number=>typeof value==="number"&&value>0);const performances=rows.map(activityPerformance).filter((value):value is NonNullable<ReturnType<typeof activityPerformance>>=>Boolean(value));return{activityType,sessions:rows.length,distanceKm:rows.reduce((sum,row)=>sum+(row.distanceKm||0),0),durationMinutes:rows.reduce((sum,row)=>sum+(row.durationMinutes||0),0),elevationMetres:rows.reduce((sum,row)=>sum+(row.elevationGainMetres||0),0),averageHeartRate:hr.length?hr.reduce((sum,value)=>sum+value,0)/hr.length:undefined,firstPerformance:performances[0]?.value,latestPerformance:performances.at(-1)?.value,performanceKind:performances.at(-1)?.kind};}).sort((a,b)=>b.sessions-a.sessions);

  const bucketMap=new Map<string,AnalyticsBucket&{heartRates:number[]}>();
  const bucketFor=(date:string)=>bucket==="week"?weekStartKey(date,weekStartsOn):bucket==="month"?date.slice(0,7):date.slice(0,4);
  const ensureBucket=(date:string)=>{const key=bucketFor(date);const current=bucketMap.get(key)||{key,label:bucket==="week"?weekLabel(key):bucket==="month"?monthLabel(key):key,sessions:0,strengthSessions:0,enduranceSessions:0,strengthVolumeKg:0,sets:0,distanceKm:0,durationMinutes:0,elevationMetres:0,heartRates:[]};bucketMap.set(key,current);return current;};
  if(bucket==="week"){for(let cursor=weekStartKey(start,weekStartsOn);cursor<=today;cursor=addCalendarDays(cursor,7))ensureBucket(cursor)}
  else if(bucket==="month"){const cursor=new Date(`${start.slice(0,7)}-01T12:00:00`),endMonth=today.slice(0,7);while(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}`<=endMonth){ensureBucket(`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-01`);cursor.setMonth(cursor.getMonth()+1)}}
  else for(let year=Number(start.slice(0,4));year<=Number(today.slice(0,4));year++)ensureBucket(`${year}-01-01`);
  currentStrength.forEach(row=>{const item=ensureBucket(row.date);item.sessions++;item.strengthSessions++;item.strengthVolumeKg+=row.volumeKg;item.sets+=row.sets;item.durationMinutes+=row.duration||0;});
  currentEndurance.forEach(row=>{const item=ensureBucket(row.date);item.sessions++;item.enduranceSessions++;item.distanceKm+=row.distanceKm||0;item.durationMinutes+=row.durationMinutes||0;item.elevationMetres+=row.elevationGainMetres||0;if(row.averageHeartRate)item.heartRates.push(row.averageHeartRate);});
  const buckets=[...bucketMap.values()].sort((a,b)=>a.key.localeCompare(b.key)).map(({heartRates,...item})=>({...item,heartRateAverage:heartRates.length?heartRates.reduce((sum,value)=>sum+value,0)/heartRates.length:undefined}));

  const strengthVolumeKg=currentStrength.reduce((sum,row)=>sum+row.volumeKg,0),strengthSets=currentStrength.reduce((sum,row)=>sum+row.sets,0),enduranceDistanceKm=currentEndurance.reduce((sum,row)=>sum+(row.distanceKm||0),0);
  const knownStrengthDuration=currentStrength.filter(row=>row.duration),knownEnduranceDuration=currentEndurance.filter(row=>row.durationMinutes);const durationMinutes=knownStrengthDuration.reduce((sum,row)=>sum+(row.duration||0),0)+knownEnduranceDuration.reduce((sum,row)=>sum+(row.durationMinutes||0),0);
  const previousDuration=previousStrength.reduce((sum,row)=>sum+(row.duration||0),0)+previousEndurance.reduce((sum,row)=>sum+(row.durationMinutes||0),0);
  const heartRates=currentEndurance.map(row=>row.averageHeartRate).filter((value):value is number=>typeof value==="number"&&value>0);
  return{range,period:{start,end:today,bucket},buckets,totalSessions:currentStrength.length+currentEndurance.length,strengthSessions:currentStrength.length,enduranceSessions:currentEndurance.length,durationMinutes,durationCoverage:knownStrengthDuration.length+knownEnduranceDuration.length,strengthVolumeKg,strengthSets,enduranceDistanceKm,elevationMetres:currentEndurance.reduce((sum,row)=>sum+(row.elevationGainMetres||0),0),heartRateAverage:heartRates.length?heartRates.reduce((sum,value)=>sum+value,0)/heartRates.length:undefined,exerciseFrequency:[...exerciseRows].sort((a,b)=>b.sessions-a.sessions||b.sets-a.sets).slice(0,5),topExercisesByVolume:[...exerciseRows].filter(row=>row.volumeKg>0).sort((a,b)=>b.volumeKg-a.volumeKg).slice(0,5),loadProgression:[...exerciseRows].filter(row=>row.loadChangeKg!=null).sort((a,b)=>Math.abs(b.loadChangeKg||0)-Math.abs(a.loadChangeKg||0)).slice(0,5),repRanges,activities,comparison:{sessions:valueComparison(currentStrength.length+currentEndurance.length,previousStrength.length+previousEndurance.length),duration:valueComparison(durationMinutes,previousDuration),volume:valueComparison(strengthVolumeKg,previousStrength.reduce((sum,row)=>sum+row.volumeKg,0)),sets:valueComparison(strengthSets,previousStrength.reduce((sum,row)=>sum+row.sets,0)),distance:valueComparison(enduranceDistanceKm,previousEndurance.reduce((sum,row)=>sum+(row.distanceKm||0),0))}};
}

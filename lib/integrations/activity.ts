import type {TrainingActivityType} from "../setra/types.ts";

export const formats=["fit","tcx","gpx"] as const;
export type FileFormat=(typeof formats)[number];
export const sports=["run","bike","swim","row","walk_hike","elliptical","cross_training","custom"] as const;
export const sportNames:Record<TrainingActivityType,string>={run:"Run",bike:"Ride",swim:"Swim",row:"Row",walk_hike:"Walk / hike",elliptical:"Elliptical",cross_training:"Cross training",custom:"Other"};
export const fileLimit=3*1024*1024;
export const uses=["ai","coach","social","shareExport","analytics"] as const;
export type UsagePermissions=Record<(typeof uses)[number],boolean>;
export type ActivitySource={provider:string;channel:"user_file"|"connector";externalId:string;permissions:UsagePermissions};
// A canonical activity participates in shared read paths and derived records. Until
// a connector has verified coverage for every use it must not enter that model.
export function canonicalAdmission(source:ActivitySource){
  if(source.channel==="user_file")return source.provider==="activity_file"&&uses.every(key=>source.permissions[key]===true);
  return false; // No connector contract has been reviewed or enabled.
}
export const uploadPolicy:UsagePermissions={ai:true,coach:true,social:true,shareExport:true,analytics:true};

export type ActivityMetrics={
  elapsedSeconds?:number;activeSeconds?:number;distanceMetres?:number;speedMps?:number;ascentMetres?:number;
  heartRate?:number;powerWatts?:number;cadence?:number;swimLengths?:number;poolLengthMetres?:number;
};
export type ActivityLap=ActivityMetrics&{start?:string};
export type ExternalActivity={
  sport:TrainingActivityType|null;start:string;finish?:string;metrics:ActivityMetrics;
  laps:ActivityLap[];notes:string[];
};
export type NormalizedActivity=ExternalActivity&{format:FileFormat};
export type ExternalActivityAdapter<Input>={normalize(input:Input):Promise<{source:ActivitySource;record:ExternalActivity}>};
export type MatchRow={id:string;title:string;sport:string;date:string;duration?:number;distance?:number;start?:string;status:"planned"|"completed";linked?:boolean};
export const validActivityDate=(date:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
  const parsed=new Date(date+"T00:00:00Z");
  return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===date;
};
export function dateAt(instant:string,zone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(instant));
  return ["year","month","day"].map(type=>parts.find(part=>part.type===type)?.value).join("-");
}
const close=(a:number|undefined,b:number|undefined,fraction:number)=>a!=null&&b!=null&&a>0&&b>0&&Math.abs(a-b)/Math.max(a,b)<=fraction;
export function matchActivities(rows:MatchRow[],activity:NormalizedActivity,date:string,sport:TrainingActivityType){
  const duration=activity.metrics.activeSeconds??activity.metrics.elapsedSeconds;
  const ranked=rows.filter(row=>row.sport===sport).map(row=>{
    const day=Math.abs(Date.parse(row.date)-Date.parse(date))/86400000;
    const startGap=row.start?Math.abs(Date.parse(row.start)-Date.parse(activity.start))/1000:Infinity;
    const durationSimilar=close(duration,row.duration,.17),distanceSimilar=close(activity.metrics.distanceMetres,row.distance,.12);
    const score=(day===0?6:day===1?2:0)+(durationSimilar?3:0)+(distanceSimilar?3:0);
    const likelyDuplicate=row.status==="completed"&&(startGap<=600&&day<=1||day===0&&durationSimilar&&distanceSimilar||row.linked&&day===0&&(durationSimilar||distanceSimilar));
    return {...row,score,likelyDuplicate};
  });
  return {plans:ranked.filter(row=>row.status==="planned"&&row.score>=6).sort((a,b)=>b.score-a.score).slice(0,8),
    possibleDuplicates:ranked.filter(row=>row.likelyDuplicate).sort((a,b)=>b.score-a.score).slice(0,8)};
}

export const activityDuration=(activity:NormalizedActivity)=>activity.metrics.activeSeconds??activity.metrics.elapsedSeconds;

const round=(n:number|undefined,digits=0)=>n==null?undefined:Number(n.toFixed(digits));
export function buildCompletedActivityPayload(activity:NormalizedActivity,sport:TrainingActivityType,date:string,today:string){
  const m=activity.metrics,duration=round(activityDuration(activity));
  const measuredSpeed=m.speedMps??(m.distanceMetres&&duration?m.distanceMetres/duration:undefined);
  const speed=measuredSpeed!=null&&measuredSpeed>=0.01&&measuredSpeed<=100?measuredSpeed:undefined;
  return {activityType:sport,title:`${sportNames[sport]} · ${activity.format.toUpperCase()} import`,date,localToday:today,
    startedAt:activity.start,endedAt:activity.finish,durationSeconds:duration,distanceMetres:round(m.distanceMetres,3),averageHeartRate:round(m.heartRate),elevationGainMetres:round(m.ascentMetres,2),
    averageSpeedKph:round(speed==null?undefined:speed*3.6,3),
    averagePaceSecondsPerKm:round(speed!=null&&["run","walk_hike","swim"].includes(sport)?1000/speed:undefined,3),
    averageSplitSecondsPer500m:round(speed!=null&&sport==="row"?500/speed:undefined,3),minimalEntryConfirmed:true};
}

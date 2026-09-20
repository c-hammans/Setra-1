import type {EnduranceSession,Workout} from "@/lib/setra/types";
import type {ShareCardData,ShareMetric,ShareSport} from "@/lib/share/share-types";
import type {AwardProgress} from "@/lib/awards/types";
import {formatLoad,type StrengthUnit} from "@/lib/setra/units";
import {strengthCompletion} from "@/lib/setra/completion";

const clock=(seconds:number)=>{const rounded=Math.max(0,Math.round(seconds));const hours=Math.floor(rounded/3600);const minutes=Math.floor((rounded%3600)/60);const secs=rounded%60;return hours?`${hours}:${String(minutes).padStart(2,"0")}:${String(secs).padStart(2,"0")}`:`${minutes}:${String(secs).padStart(2,"0")}`};
const duration=(minutes?:number)=>minutes?clock(minutes*60):"";
const sessionDuration=(start:string,finish?:string)=>{if(!finish)return"";const [sh,sm]=start.split(":").map(Number);const [fh,fm]=finish.split(":").map(Number);let mins=fh*60+fm-(sh*60+sm);if(mins<0)mins+=1440;if(mins<=0)return"";const hours=Math.floor(mins/60),remainder=mins%60;return[hours?`${hours}h`:"",remainder?`${remainder}m`:""].filter(Boolean).join(" ")};
const compactNumber=(value:number)=>new Intl.NumberFormat("en-AU",{maximumFractionDigits:value>=100?0:2}).format(value);
const activityNames:Record<EnduranceSession["activityType"],string>={run:"Run",bike:"Ride",swim:"Swim",row:"Row",walk_hike:"Walk / hike",elliptical:"Elliptical",cross_training:"Cross-training",custom:"Endurance"};

export function strengthWorkoutShareData(workout:Workout,unit:StrengthUnit="kg"):ShareCardData{
  const completion=strengthCompletion(workout);
  const included=workout.exercises.filter(exercise=>!exercise.skipped);
  const completedSets=included.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0);
  const volume=included.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done&&(exercise.loadMode==null||exercise.loadMode==="kg")).reduce((setSum,set)=>setSum+(Number(set.weight)||0)*(Number(set.reps)||0),0),0);
  const metrics:ShareMetric[]=[];
  const elapsed=sessionDuration(workout.startedAt,workout.endedAt);
  if(elapsed)metrics.push({label:"Duration",value:elapsed});
  if(completedSets)metrics.push({label:"Sets",value:String(completedSets)});
  if(volume)metrics.push({label:"Volume",value:formatLoad(volume,unit)});
  return{id:workout.id,kind:"workout",sport:"strength",label:completion.status==="partial"?"Strength · partial":"Strength complete",title:workout.name||"Workout complete",result:completion.status==="partial"?`${completion.completedSets} of ${completion.plannedSets} sets`:"Workout complete",date:workout.date,metrics};
}

export function enduranceWorkoutShareData(session:EnduranceSession):ShareCardData{
  const sport=session.activityType as ShareSport;
  const distanceKm=session.distanceKm??session.plannedDistanceKm;
  const sessionMinutes=session.durationMinutes??session.plannedDurationMinutes;
  const swim=session.activityType==="swim";
  const result=distanceKm?swim?`${compactNumber(distanceKm*1000)} m`:`${compactNumber(distanceKm)} km`:duration(sessionMinutes)||session.title;
  const metrics:ShareMetric[]=[];
  if(sessionMinutes)metrics.push({label:"Time",value:duration(sessionMinutes)});
  if(session.averagePaceSecondsPerKm)metrics.push({label:"Avg pace",value:swim?`${clock(session.averagePaceSecondsPerKm/10)} /100m`:`${clock(session.averagePaceSecondsPerKm)} /km`});
  else if(session.averageSplitSecondsPer500m)metrics.push({label:"Avg split",value:`${clock(session.averageSplitSecondsPer500m)} /500m`});
  else if(session.averageSpeedKph)metrics.push({label:"Avg speed",value:`${session.averageSpeedKph.toFixed(1)} km/h`});
  if(session.elevationGainMetres)metrics.push({label:"Elevation",value:`${compactNumber(session.elevationGainMetres)} m`});
  if(session.averageHeartRate)metrics.push({label:"Avg HR",value:`${Math.round(session.averageHeartRate)} bpm`});
  return{id:session.id,kind:"workout",sport,label:`${activityNames[session.activityType]} complete`,title:session.title,result,date:session.date,metrics:metrics.slice(0,3)};
}

export function strengthPBShareData(pb:{exerciseId:string;name:string;weight:number;reps:string;previousWeight?:number},unit:StrengthUnit="kg"):ShareCardData{
  const improvement=pb.previousWeight&&pb.weight>pb.previousWeight?pb.weight-pb.previousWeight:undefined;
  return{id:pb.exerciseId,kind:"pb",sport:"strength",label:"New highest load",title:pb.name,result:formatLoad(pb.weight,unit),secondary:pb.reps?`× ${pb.reps} reps`:undefined,improvement:improvement?`+${formatLoad(improvement,unit)}`:undefined,previous:pb.previousWeight?`Previous highest load ${formatLoad(pb.previousWeight,unit)}`:undefined,metrics:[]};
}

export function awardShareData(award:AwardProgress):ShareCardData{
  return{id:award.definition.id,kind:"award",sport:"custom",label:"Award earned",title:"The work adds up.",result:award.definition.title,date:award.earnedAt?.slice(0,10),metrics:[]};
}

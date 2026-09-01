import type {TrainingActivityType,TrainingSessionBlock,TrainingTargetMetric} from "@/lib/setra/types";

export const formatStepClock=(seconds?:number)=>seconds==null?"":`${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,"0")}`;
export const parseStepClock=(value:string)=>{const clean=value.trim();if(!clean)return undefined;const parts=clean.split(":").map(Number);if(parts.some(Number.isNaN))return undefined;return parts.length===1?parts[0]*60:parts[0]*60+parts[1]};
export const formatStepTime=(seconds:number)=>seconds%60===0?`${seconds/60} min`:`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
export const stepDistanceUsesMetres=(activity:TrainingActivityType)=>activity==="swim"||activity==="row";
export const displayStepDistance=(metres:number|undefined,activity:TrainingActivityType)=>metres==null?"":String(stepDistanceUsesMetres(activity)?metres:Number((metres/1000).toFixed(3)));
export const stepTargetUnit=(activity:TrainingActivityType,metric:TrainingTargetMetric)=>metric==="pace"?(activity==="swim"?"seconds_per_100m":activity==="row"?"seconds_per_500m":"seconds_per_km"):metric==="speed"?"km_per_hour":metric==="heart_rate"?"bpm":metric==="power"?"watts":metric==="cadence"?"rpm":metric==="rpe"?"rpe":"effort";
export const stepTargetSuffix=(unit?:string)=>unit==="seconds_per_100m"?"/100 m":unit==="seconds_per_500m"?"/500 m":unit==="seconds_per_km"?"/km":unit==="km_per_hour"?"km/h":unit==="bpm"?"bpm":unit==="watts"?"W":unit==="rpm"?"rpm":unit==="rpe"?"/10":"";

export const enduranceTargetOptions=(activity:TrainingActivityType):[TrainingTargetMetric,string][]=>{
  const common:[TrainingTargetMetric,string][]=[["heart_rate","Heart-rate range"],["rpe","RPE range"],["effort","Effort description"]];
  if(activity==="bike")return [["speed","Speed range"],["power","Power range"],["cadence","Cadence range"],...common];
  if(activity==="row")return [["pace","Split range"],["power","Power range"],["cadence","Stroke-rate range"],...common];
  if(activity==="run"||activity==="walk_hike"||activity==="swim")return [["pace","Pace range"],["cadence","Cadence range"],...common];
  return [["speed","Speed range"],["cadence","Cadence range"],...common];
};

export function formatTrainingStep(block:TrainingSessionBlock,activity:TrainingActivityType){
  const repeats=Math.max(1,block.repetitions||1);
  if(block.type==="repeat_group")return `${repeats} ${repeats===1?"round":"rounds"}`;
  const parts:string[]=[];if(repeats>1)parts.push(`${repeats} ×`);
  if(block.completionType==="time"&&block.durationSeconds)parts.push(formatStepTime(block.durationSeconds));
  else if(block.completionType==="distance"&&block.distanceMetres!=null)parts.push(stepDistanceUsesMetres(activity)?`${block.distanceMetres} m`:`${Number((block.distanceMetres/1000).toFixed(2))} km`);
  else if(block.completionType==="lap_button")parts.push("until lap press");
  if(block.targetMetric==="effort"&&block.intensityTarget)parts.push(block.intensityTarget);
  else if(block.targetMetric&&block.targetMinValue!=null){const low=block.targetMetric==="pace"?formatStepClock(block.targetMinValue):Number(block.targetMinValue.toFixed(1));const high=block.targetMaxValue==null?low:block.targetMetric==="pace"?formatStepClock(block.targetMaxValue):Number(block.targetMaxValue.toFixed(1));parts.push(`${low}${high!==low?`–${high}`:""} ${stepTargetSuffix(block.targetUnit)}`.trim())}
  if(block.recoveryDurationSeconds)parts.push(`recover ${formatStepTime(block.recoveryDurationSeconds)}`);else if(block.recoveryDistanceMetres)parts.push(`recover ${stepDistanceUsesMetres(activity)?`${block.recoveryDistanceMetres} m`:`${Number((block.recoveryDistanceMetres/1000).toFixed(2))} km`}`);
  return parts.join(" · ")||block.instructions||"Open step";
}

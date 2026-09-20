import type {EnduranceSession,EnduranceTemplate,TrainingSessionBlock} from "../setra/types.ts";

export type EnduranceEditorTab="details"|"structure"|"notes";
export type ValidationIssue={field:string;tab:EnduranceEditorTab;message:string;blockId?:string;code?:"minimal_confirmation"};

const finite=(value:number|undefined)=>value==null||Number.isFinite(value);
const nonNegative=(value:number|undefined)=>finite(value)&&(value==null||value>=0);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T12:00:00`).getTime());

function validateBlock(block:TrainingSessionBlock,index:number):ValidationIssue[]{
  const issues:ValidationIssue[]=[];const prefix=`Step ${index+1}`;const add=(field:string,message:string)=>issues.push({field,tab:"structure",message:`${prefix}: ${message}`,blockId:block.id});
  if(!block.id?.trim())add("id","is missing its identifier.");
  if(block.repetitions!=null&&(!Number.isInteger(block.repetitions)||block.repetitions<1||block.repetitions>1000))add("repetitions","repeats must be a whole number from 1 to 1,000.");
  if(!nonNegative(block.durationSeconds))add("durationSeconds","duration cannot be negative or invalid.");
  if(!nonNegative(block.distanceMetres))add("distanceMetres","distance cannot be negative or invalid.");
  if(!nonNegative(block.recoveryDurationSeconds))add("recoveryDurationSeconds","recovery duration cannot be negative or invalid.");
  if(!nonNegative(block.recoveryDistanceMetres))add("recoveryDistanceMetres","recovery distance cannot be negative or invalid.");
  if(block.completionType==="time"&&!(Number.isFinite(block.durationSeconds)&&Number(block.durationSeconds)>0))add("durationSeconds","a time goal needs a duration greater than zero.");
  if(block.completionType==="distance"&&!(Number.isFinite(block.distanceMetres)&&Number(block.distanceMetres)>0))add("distanceMetres","a distance goal needs a distance greater than zero.");
  if(!nonNegative(block.targetMinValue)||!nonNegative(block.targetMaxValue))add("target","target values cannot be negative or invalid.");
  if(block.targetMinValue!=null&&block.targetMaxValue!=null&&block.targetMinValue>block.targetMaxValue)add("target","minimum/fastest cannot be greater than maximum/slowest.");
  if(block.targetMetric==="rpe"&&((block.targetMinValue??0)>10||(block.targetMaxValue??0)>10))add("target","RPE targets must be between 0 and 10.");
  if(block.parentId===block.id)add("parentId","cannot contain itself.");
  return issues;
}

export function validateEnduranceRecord(value:EnduranceSession|EnduranceTemplate,options:{today?:string;allowMinimalCompleted?:boolean}={}):ValidationIssue[]{
  const issues:ValidationIssue[]=[];const session="status" in value?value:null;
  const add=(field:string,tab:EnduranceEditorTab,message:string,code?:ValidationIssue["code"])=>issues.push({field,tab,message,code});
  if(!value.title.trim())add("title","details","Workout name is required.");
  if(value.title.length>120)add("title","details","Workout name must be 120 characters or fewer.");
  if(!nonNegative(value.plannedDurationMinutes))add("duration","details","Duration cannot be negative or invalid.");
  if(!nonNegative(value.plannedDistanceKm))add("distance","details","Distance cannot be negative or invalid.");
  if(!finite(value.targetRpe)||(value.targetRpe!=null&&(value.targetRpe<0||value.targetRpe>10)))add("rpe","details","RPE must be between 0 and 10.");
  if(session){
    if(!validDate(session.date))add("date","details","Choose a valid date.");
    if(session.status==="completed"&&options.today&&session.date>options.today)add("date","details","Completed activities cannot be dated in the future. Plan the session instead.");
    if(!nonNegative(session.durationMinutes))add("duration","details","Completed duration cannot be negative or invalid.");
    if(!nonNegative(session.distanceKm))add("distance","details","Completed distance cannot be negative or invalid.");
    if(!finite(session.rpe)||(session.rpe!=null&&(session.rpe<0||session.rpe>10)))add("rpe","details","Session RPE must be between 0 and 10.");
    if(!finite(session.averageHeartRate)||(session.averageHeartRate!=null&&(session.averageHeartRate<20||session.averageHeartRate>260)))add("heartRate","details","Average heart rate must be between 20 and 260 bpm.");
    if(!nonNegative(session.elevationGainMetres))add("elevation","details","Elevation cannot be negative or invalid.");
    const meaningful=session.durationMinutes!=null||session.distanceKm!=null||session.blocks.length>0||Boolean(session.notes.trim())||Boolean(session.startedAt);
    if(session.status==="completed"&&!meaningful&&!options.allowMinimalCompleted)add("minimal","details","This activity has no performance details. Confirm that you want to save a minimal diary entry.","minimal_confirmation");
  }
  const ids=new Set<string>();
  value.blocks.forEach((block,index)=>{if(ids.has(block.id))issues.push({field:"id",tab:"structure",blockId:block.id,message:`Step ${index+1}: has a duplicate identifier.`});ids.add(block.id);issues.push(...validateBlock(block,index))});
  value.blocks.forEach((block,index)=>{if(block.parentId&&!ids.has(block.parentId))issues.push({field:"parentId",tab:"structure",blockId:block.id,message:`Step ${index+1}: refers to a repeat group that no longer exists.`})});
  return issues;
}

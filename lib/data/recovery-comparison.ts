import type {EnduranceSession,EnduranceTemplate,Template,Workout} from "@/lib/setra/types";
import type {PendingDiaryChange} from "./local-diary";

export type RecoveryField={label:string;device:string;cloud:string;different:boolean};

const text=(value:unknown)=>value==null||value===""?"Not recorded":String(value);
const setSummary=(set:{weight:string;reps:string;rpe:string;done:boolean;note?:string},index:number)=>`set ${index+1}: ${set.done?"done":"planned"}, load ${set.weight||"—"}, reps ${set.reps||"—"}, RPE ${set.rpe||"—"}${set.note?`, note ${set.note}`:""}`;
const exerciseSummary=(item:Workout["exercises"][number],index:number)=>`${index+1}. ${item.exerciseId} · ${item.loadMode||"kg"}${item.group?` · group ${item.group}`:""}${item.repTarget?` · target ${item.repTarget}`:""}${item.plannedLoad?` · planned ${item.plannedLoad.mode} ${item.plannedLoad.value}`:""}${item.skipped?" · skipped":""} · ${item.sets.map(setSummary).join("; ")||"no sets"}`;
const blockSummary=(item:EnduranceSession["blocks"][number],index:number)=>`${index+1}. ${item.title||item.type} [${item.type}]${item.parentId?` · parent ${item.parentId}`:""}${item.repetitions?` · repeat ×${item.repetitions}`:""}${item.completionType?` · ends ${item.completionType}`:""}${item.distanceMetres!=null?` · ${item.distanceMetres} m`:""}${item.durationSeconds!=null?` · ${item.durationSeconds} sec`:""}${item.recoveryDistanceMetres!=null?` · recovery ${item.recoveryDistanceMetres} m`:""}${item.recoveryDurationSeconds!=null?` · recovery ${item.recoveryDurationSeconds} sec`:""}${item.targetMetric?` · ${item.targetMetric} ${item.targetMinValue??""}${item.targetMaxValue!=null?`–${item.targetMaxValue}`:""} ${item.targetUnit||""}`:""}${item.intensityTarget?` · guidance ${item.intensityTarget}`:""}${item.instructions?` · instructions ${item.instructions}`:""}`;
const workoutSummary=(workout:Workout,status?:"in_progress"|"completed")=>({
  Name:workout.name,
  Date:workout.date,
  Status:status==="completed"||workout.completedAt?"Completed":"In progress",
  Exercises:`${workout.exercises.length}`,
  Sets:`${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)}`,
  "Completed sets":`${workout.exercises.reduce((sum,item)=>sum+item.sets.filter(set=>set.done).length,0)}`,
  "Exercise detail":workout.exercises.map(exerciseSummary).join(" | ")||"Not recorded",
  "Session notes":workout.note||"Not recorded",
  "Exercise notes":workout.exercises.map((item,index)=>item.note||item.planNote?`${index+1}. ${item.exerciseId}: ${[item.planNote,item.note].filter(Boolean).join(" / ")}`:"").filter(Boolean).join(" | ")||"Not recorded",
  "Warm-up":(workout.warmup||[]).map((item,index)=>`${index+1}. ${item.kind}: ${item.title||item.exerciseId||"Instructions"}${item.instructions?` · ${item.instructions}`:""}${item.done?" · done":""}`).join(" | ")||"Not recorded",
  Modified:workout.updatedAt||"Not recorded",
});
const templateSummary=(template:Template)=>({Name:template.name,Focus:template.focus||"Not recorded","Exercise detail":template.exercises.map((item,index)=>`${index+1}. ${item.exerciseId} · ${item.sets} sets · reps ${item.reps||"—"}${item.group?` · group ${item.group}`:""}${item.plannedLoad?` · ${item.plannedLoad.mode} ${item.plannedLoad.value}`:""}${item.note?` · note ${item.note}`:""}`).join(" | ")||"Not recorded","Superset names":Object.entries(template.supersetNames||{}).map(([key,value])=>`${key}: ${value}`).join(" | ")||"Not recorded"});
const enduranceSummary=(session:EnduranceSession)=>({Title:session.title,Date:session.date,Status:session.status,Activity:session.activityType,Distance:session.distanceKm==null&&session.plannedDistanceKm==null?"Not recorded":`${session.distanceKm??session.plannedDistanceKm} km`,Duration:session.durationMinutes==null&&session.plannedDurationMinutes==null?"Not recorded":`${session.durationMinutes??session.plannedDurationMinutes} min`,Structure:session.blocks.map(blockSummary).join(" | ")||"Not recorded","Session notes":session.notes||"Not recorded",Modified:session.completedAt||"Not recorded"});
const enduranceTemplateSummary=(template:EnduranceTemplate)=>({Title:template.title,Activity:template.activityType,Distance:template.plannedDistanceKm==null?"Not recorded":`${template.plannedDistanceKm} km`,Duration:template.plannedDurationMinutes==null?"Not recorded":`${template.plannedDurationMinutes} min`,Structure:template.blocks.map(blockSummary).join(" | ")||"Not recorded","Session notes":template.notes||"Not recorded"});

export function recoveryComparison(change:PendingDiaryChange,cloud:unknown):RecoveryField[]{
  let device:Record<string,string>={};let remote:Record<string,string>={};
  if(change.kind==="save_workout"){device=workoutSummary(change.payload.workout,change.payload.status);if(cloud)remote=workoutSummary(cloud as Workout)}
  else if(change.kind==="save_strength_template"){device=templateSummary(change.payload.template);if(cloud)remote=templateSummary(cloud as Template)}
  else if(change.kind==="save_endurance_session"){device=enduranceSummary(change.payload.session);if(cloud)remote=enduranceSummary(cloud as EnduranceSession)}
  else if(change.kind==="save_endurance_template"){device=enduranceTemplateSummary(change.payload.template);if(cloud)remote=enduranceTemplateSummary(cloud as EnduranceTemplate)}
  else return [{label:"Change",device:change.kind.startsWith("delete_")?"Delete pending":"Schedule update pending",cloud:cloud?"Cloud version exists":"No cloud record",different:true}];
  return Object.keys(device).map(label=>({label,device:text(device[label]),cloud:cloud?text(remote[label]):"No cloud record",different:!cloud||device[label]!==remote[label]}));
}

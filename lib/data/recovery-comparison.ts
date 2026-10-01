import type {EnduranceSession,EnduranceTemplate,Template,Workout} from "@/lib/setra/types";
import type {PendingDiaryChange} from "./local-diary";

export type RecoveryField={label:string;device:string;cloud:string;different:boolean};

const text=(value:unknown)=>value==null||value===""?"Not recorded":String(value);
const setSummary=(set:{weight:string;reps:string;rpe:string;done:boolean},index:number)=>`${index+1}: ${set.done?"done":"planned"} · ${set.weight||"–"} × ${set.reps||"–"}${set.rpe?` · RPE ${set.rpe}`:""}`;
const exerciseSummary=(item:Workout["exercises"][number])=>`${item.skipped?"Skipped":`${item.sets.filter(set=>set.done).length}/${item.sets.length} sets`} · ${item.sets.map(setSummary).join("; ")||"no sets"}`;
const blockSummary=(item:EnduranceSession["blocks"][number],index:number)=>`${index+1}. ${item.title||item.type} [${item.type}]${item.parentId?` · parent ${item.parentId}`:""}${item.repetitions?` · repeat ×${item.repetitions}`:""}${item.completionType?` · ends ${item.completionType}`:""}${item.distanceMetres!=null?` · ${item.distanceMetres} m`:""}${item.durationSeconds!=null?` · ${item.durationSeconds} sec`:""}${item.recoveryDistanceMetres!=null?` · recovery ${item.recoveryDistanceMetres} m`:""}${item.recoveryDurationSeconds!=null?` · recovery ${item.recoveryDurationSeconds} sec`:""}${item.targetMetric?` · ${item.targetMetric} ${item.targetMinValue??""}${item.targetMaxValue!=null?`–${item.targetMaxValue}`:""} ${item.targetUnit||""}`:""}${item.intensityTarget?` · guidance ${item.intensityTarget}`:""}${item.instructions?` · instructions ${item.instructions}`:""}`;
const workoutSummary=(workout:Workout,status?:"in_progress"|"completed")=>({
  Name:workout.name,
  Date:workout.date,
  Status:status==="completed"||workout.completedAt?"Completed":"In progress",
  Exercises:`${workout.exercises.length}`,
  Sets:`${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)}`,
  "Completed sets":`${workout.exercises.reduce((sum,item)=>sum+item.sets.filter(set=>set.done).length,0)}`,
  "Session notes":workout.note||"Not recorded",
  "Exercise notes":workout.exercises.map((item,index)=>item.note||item.planNote?`${index+1}. ${item.exerciseId}: ${[item.planNote,item.note].filter(Boolean).join(" / ")}`:"").filter(Boolean).join(" | ")||"Not recorded",
  "Warm-up":(workout.warmup||[]).map((item,index)=>`${index+1}. ${item.kind}: ${item.title||item.exerciseId||"Instructions"}${item.instructions?` · ${item.instructions}`:""}${item.done?" · done":""}`).join(" | ")||"Not recorded",
  Modified:workout.updatedAt||"Not recorded",
});
const templateSummary=(template:Template)=>({Name:template.name,Focus:template.focus||"Not recorded","Exercise detail":template.exercises.map((item,index)=>`${index+1}. ${item.exerciseId} · ${item.sets} sets · reps ${item.reps||"–"}${item.group?` · group ${item.group}`:""}${item.plannedLoad?` · ${item.plannedLoad.mode} ${item.plannedLoad.value}`:""}${item.note?` · note ${item.note}`:""}`).join(" | ")||"Not recorded","Superset names":Object.entries(template.supersetNames||{}).map(([key,value])=>`${key}: ${value}`).join(" | ")||"Not recorded"});
const enduranceSummary=(session:EnduranceSession)=>({Title:session.title,Date:session.date,Status:session.status,Activity:session.activityType,Distance:session.distanceKm==null&&session.plannedDistanceKm==null?"Not recorded":`${session.distanceKm??session.plannedDistanceKm} km`,Duration:session.durationMinutes==null&&session.plannedDurationMinutes==null?"Not recorded":`${session.durationMinutes??session.plannedDurationMinutes} min`,Structure:session.blocks.map(blockSummary).join(" | ")||"Not recorded","Session notes":session.notes||"Not recorded",Modified:session.completedAt||"Not recorded"});
const enduranceTemplateSummary=(template:EnduranceTemplate)=>({Title:template.title,Activity:template.activityType,Distance:template.plannedDistanceKm==null?"Not recorded":`${template.plannedDistanceKm} km`,Duration:template.plannedDurationMinutes==null?"Not recorded":`${template.plannedDurationMinutes} min`,Structure:template.blocks.map(blockSummary).join(" | ")||"Not recorded","Session notes":template.notes||"Not recorded"});

export function recoveryComparison(change:PendingDiaryChange,cloud:unknown):RecoveryField[]{
  let device:Record<string,string>={};let remote:Record<string,string>={};
  if(change.kind==="save_workout"){
    const deviceWorkout=change.payload.workout;const cloudWorkout=cloud as Workout|null;
    device=workoutSummary(deviceWorkout,change.payload.status);if(cloudWorkout)remote=workoutSummary(cloudWorkout);
    const fields=Object.keys(device).map(label=>({label,device:text(device[label]),cloud:cloudWorkout?text(remote[label]):"No cloud record",different:!cloudWorkout||device[label]!==remote[label]})).filter(field=>field.different);
    const count=Math.max(deviceWorkout.exercises.length,cloudWorkout?.exercises.length||0);
    for(let index=0;index<count;index++){
      const local=deviceWorkout.exercises[index];const remoteExercise=cloudWorkout?.exercises[index];
      const localText=local?`${local.exerciseId} · ${exerciseSummary(local)}`:"Not present";
      const remoteText=remoteExercise?`${remoteExercise.exerciseId} · ${exerciseSummary(remoteExercise)}`:"Not present";
      if(localText!==remoteText)fields.push({label:`Exercise ${index+1}`,device:localText,cloud:remoteText,different:true});
    }
    return fields.length?fields:[{label:"Workout",device:"No content differences",cloud:"No content differences",different:false}];
  }
  else if(change.kind==="save_strength_template"){device=templateSummary(change.payload.template);if(cloud)remote=templateSummary(cloud as Template)}
  else if(change.kind==="save_endurance_session"){device=enduranceSummary(change.payload.session);if(cloud)remote=enduranceSummary(cloud as EnduranceSession)}
  else if(change.kind==="save_endurance_template"){device=enduranceTemplateSummary(change.payload.template);if(cloud)remote=enduranceTemplateSummary(cloud as EnduranceTemplate)}
  else return [{label:"Change",device:change.kind.startsWith("delete_")?"Delete pending":"Schedule update pending",cloud:cloud?"Cloud version exists":"No cloud record",different:true}];
  const fields=Object.keys(device).map(label=>({label,device:text(device[label]),cloud:cloud?text(remote[label]):"No cloud record",different:!cloud||device[label]!==remote[label]})).filter(field=>field.different);
  return fields.length?fields:[{label:"Item",device:"No content differences",cloud:"No content differences",different:false}];
}

import type {EnduranceSession,EnduranceTemplate,Template,Workout} from "@/lib/setra/types";
import type {PendingDiaryChange} from "./local-diary";

export type RecoveryField={label:string;device:string;cloud:string;different:boolean};

const text=(value:unknown)=>value==null||value===""?"Not recorded":String(value);
const workoutSummary=(workout:Workout,status?:"in_progress"|"completed")=>({
  Date:workout.date,
  Status:status==="completed"||workout.completedAt?"Completed":"In progress",
  Exercises:`${workout.exercises.length}`,
  Sets:`${workout.exercises.reduce((sum,item)=>sum+item.sets.length,0)}`,
  "Completed sets":`${workout.exercises.reduce((sum,item)=>sum+item.sets.filter(set=>set.done).length,0)}`,
  Loads:workout.exercises.flatMap(item=>item.sets.filter(set=>set.done&&set.weight).map(set=>set.weight)).join(", ")||"Not recorded",
  Repetitions:workout.exercises.flatMap(item=>item.sets.filter(set=>set.done&&set.reps).map(set=>set.reps)).join(", ")||"Not recorded",
  Notes:workout.note||workout.exercises.map(item=>item.note).filter(Boolean).join(" · ")||"Not recorded",
  Modified:workout.updatedAt||"Not recorded",
});
const templateSummary=(template:Template)=>({Focus:template.focus||"Not recorded",Exercises:`${template.exercises.length}`,Sets:`${template.exercises.reduce((sum,item)=>sum+item.sets,0)}`,"Rep targets":template.exercises.map(item=>item.reps).filter(Boolean).join(", ")||"Not recorded",Notes:template.exercises.map(item=>item.note).filter(Boolean).join(" · ")||"Not recorded"});
const enduranceSummary=(session:EnduranceSession)=>({Date:session.date,Status:session.status,Activity:session.activityType,Distance:session.distanceKm==null&&session.plannedDistanceKm==null?"Not recorded":`${session.distanceKm??session.plannedDistanceKm} km`,Duration:session.durationMinutes==null&&session.plannedDurationMinutes==null?"Not recorded":`${session.durationMinutes??session.plannedDurationMinutes} min`,Structure:`${session.blocks.length} structured ${session.blocks.length===1?"item":"items"}`,Notes:session.notes||"Not recorded",Modified:session.completedAt||"Not recorded"});
const enduranceTemplateSummary=(template:EnduranceTemplate)=>({Activity:template.activityType,Distance:template.plannedDistanceKm==null?"Not recorded":`${template.plannedDistanceKm} km`,Duration:template.plannedDurationMinutes==null?"Not recorded":`${template.plannedDurationMinutes} min`,Structure:`${template.blocks.length} structured ${template.blocks.length===1?"item":"items"}`,Notes:template.notes||"Not recorded"});

export function recoveryComparison(change:PendingDiaryChange,cloud:unknown):RecoveryField[]{
  let device:Record<string,string>={};let remote:Record<string,string>={};
  if(change.kind==="save_workout"){device=workoutSummary(change.payload.workout,change.payload.status);if(cloud)remote=workoutSummary(cloud as Workout,change.payload.status)}
  else if(change.kind==="save_strength_template"){device=templateSummary(change.payload.template);if(cloud)remote=templateSummary(cloud as Template)}
  else if(change.kind==="save_endurance_session"){device=enduranceSummary(change.payload.session);if(cloud)remote=enduranceSummary(cloud as EnduranceSession)}
  else if(change.kind==="save_endurance_template"){device=enduranceTemplateSummary(change.payload.template);if(cloud)remote=enduranceTemplateSummary(cloud as EnduranceTemplate)}
  else return [{label:"Change",device:change.kind.startsWith("delete_")?"Delete pending":"Schedule update pending",cloud:cloud?"Cloud version exists":"No cloud record",different:true}];
  return Object.keys(device).map(label=>({label,device:text(device[label]),cloud:cloud?text(remote[label]):"No cloud record",different:!cloud||device[label]!==remote[label]}));
}

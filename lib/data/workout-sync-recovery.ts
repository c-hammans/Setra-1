import type {Workout} from "@/lib/setra/types";
import type {PendingDiaryChange} from "./local-diary";

const sameOptionalText=(device:unknown,cloud:unknown)=>{
  const local=String(device??"").trim();
  return local===""||local===String(cloud??"").trim();
};

const setIsPreserved=(device:Workout["exercises"][number]["sets"][number],cloud:Workout["exercises"][number]["sets"][number]|undefined)=>{
  if(!cloud)return false;
  if(device.done&&!cloud.done)return false;
  return sameOptionalText(device.weight,cloud.weight)&&sameOptionalText(device.reps,cloud.reps)&&sameOptionalText(device.rpe,cloud.rpe)&&sameOptionalText(device.note,cloud.note);
};

/**
 * A completed cloud workout safely supersedes a device draft only when it has
 * the same stable identity and contains every meaningful value already present
 * in the draft. Divergent local values remain a real conflict for the user.
 */
export function completedCloudContainsDraft(device:Workout,cloud:Workout|null|undefined){
  if(!cloud?.completedAt||device.id!==cloud.id)return false;
  if(device.name!==cloud.name||device.date!==cloud.date||device.templateId!==cloud.templateId)return false;
  if(!sameOptionalText(device.note,cloud.note))return false;
  if((device.warmup||[]).some((item,index)=>{
    const remote=(cloud.warmup||[])[index];
    return !remote||item.id!==remote.id||(item.done&&!remote.done)||!sameOptionalText(item.title,remote.title)||!sameOptionalText(item.instructions,remote.instructions);
  }))return false;
  if(device.exercises.length>cloud.exercises.length)return false;
  return device.exercises.every((exercise,index)=>{
    const remote=cloud.exercises[index];
    if(!remote||exercise.exerciseId!==remote.exerciseId)return false;
    if(exercise.skipped&&!remote.skipped)return false;
    if(!sameOptionalText(exercise.note,remote.note)||!sameOptionalText(exercise.planNote,remote.planNote))return false;
    return exercise.sets.every((set,setIndex)=>setIsPreserved(set,remote.sets[setIndex]));
  });
}

export function completedCloudSupersedesDraft(change:PendingDiaryChange,cloud:Workout|null|undefined,serverVersion?:number){
  if(change.kind!=="save_workout"||change.payload.status!=="in_progress")return false;
  if(serverVersion!=null&&serverVersion<=change.expectedVersion)return false;
  return completedCloudContainsDraft(change.payload.workout,cloud);
}

export function recoveryCopyClientId(clientId:string,operationId:string){
  return `${clientId}-recovered-${operationId}`;
}

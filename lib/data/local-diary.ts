import type { AppData, EnduranceSession, EnduranceTemplate, Template, Workout } from "@/lib/setra/types";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";
import {mergeUniqueOperations,nextRevision,normalizePendingChanges,selectDurablePendingLeaves} from "@/lib/data/pending-queue";

const DIARY_KEY="form-strength-diary";
const DRAFT_KEY="form-active-workout";
const OWNER_KEY="form-strength-diary-owner";
const APP_COLOUR_KEY="form-app-colour";
const APPEARANCE_KEY="form-appearance";
const TEXT_SCALE_KEY="form-text-scale";
const ENDURANCE_KEY="form-endurance-sessions";
const ENDURANCE_TEMPLATES_KEY="form-endurance-templates";
const PENDING_CHANGES_KEY="form-pending-diary-changes";
const PENDING_OPERATION_KEY="form-pending-diary-operation";
const WRITE_VERSIONS_KEY="form-cloud-write-versions";
const STRENGTH_EDITOR_DRAFT_KEY="form-strength-editor-draft";
const ENDURANCE_EDITOR_DRAFT_KEY="form-endurance-editor-draft";
const COMPLETED_WORKOUT_EDITOR_DRAFT_KEY="form-completed-workout-editor-draft";
const accountKey=(base:string,userId?:string|null)=>userId?`${base}:${userId}`:base;
export type LocalWriteResult={ok:boolean;updatedAt:string;error?:string};
export type LocalDraftSnapshot={workout:Workout;updatedAt:string};
export type StrengthEditorDraft={template:Template;updatedAt:string};
export type EnduranceEditorDraft={mode:"template"|"plan"|"log";value:EnduranceSession|EnduranceTemplate;updatedAt:string};
export type CompletedWorkoutEditorDraft={workout:Workout;editingWorkoutId:string;updatedAt:string};
export type PendingFailure={kind:"conflict"|"authentication"|"validation"|"permanent"|"transient";message:string;attempts:number;nextRetryAt?:string};
type PendingMetadata={key:string;operationId:string;revision:number;expectedVersion:number;protocolVersion?:2;updatedAt:string;failure?:PendingFailure;supersedesOperationId?:string};
export type PendingDiaryChange=PendingMetadata&(
  |{kind:"save_workout";payload:{workout:Workout;status:"in_progress"|"completed"}}
  |{kind:"replace_schedule";payload:{items:AppData["scheduled"]}}
  |{kind:"save_strength_template";payload:{template:Template}}
  |{kind:"save_endurance_session";payload:{session:EnduranceSession}}
  |{kind:"save_endurance_template";payload:{template:EnduranceTemplate}}
  |{kind:"delete_workout";payload:{clientId:string}}
  |{kind:"delete_strength_template";payload:{clientId:string}}
  |{kind:"delete_endurance_session";payload:{clientId:string}}
  |{kind:"delete_endurance_template";payload:{clientId:string}}
);
type PendingDiaryChangeInput=
  |{key:string;kind:"save_workout";payload:{workout:Workout;status:"in_progress"|"completed"}}
  |{key:string;kind:"replace_schedule";payload:{items:AppData["scheduled"]}}
  |{key:string;kind:"save_strength_template";payload:{template:Template}}
  |{key:string;kind:"save_endurance_session";payload:{session:EnduranceSession}}
  |{key:string;kind:"save_endurance_template";payload:{template:EnduranceTemplate}}
  |{key:string;kind:"delete_workout";payload:{clientId:string}}
  |{key:string;kind:"delete_strength_template";payload:{clientId:string}}
  |{key:string;kind:"delete_endurance_session";payload:{clientId:string}}
  |{key:string;kind:"delete_endurance_template";payload:{clientId:string}};
export type PendingQueueResult=LocalWriteResult&{key:string;operationId:string;revision:number;expectedVersion:number;protocolVersion:2};

export function loadLocalDiary(userId?:string|null):AppData|null{
  if(typeof window==="undefined")return null;
  try{const value=window.localStorage.getItem(accountKey(DIARY_KEY,userId));return value?JSON.parse(value) as AppData:null}catch{return null}
}
export function saveLocalDiary(data:AppData,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(DIARY_KEY,userId),JSON.stringify(data));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"Browser storage is full or unavailable."}}}
export function loadLocalDraftSnapshot(userId?:string|null):LocalDraftSnapshot|null{if(typeof window==="undefined")return null;try{const value=window.localStorage.getItem(accountKey(DRAFT_KEY,userId));if(!value)return null;const parsed=JSON.parse(value) as Workout|LocalDraftSnapshot;if("workout" in parsed&&parsed.workout)return parsed;const workout=parsed as Workout;return {workout,updatedAt:workout.updatedAt||"1970-01-01T00:00:00.000Z"}}catch{return null}}
export function loadLocalDraft(userId?:string|null):Workout|null{return loadLocalDraftSnapshot(userId)?.workout||null}
export function saveLocalDraft(workout:Workout,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return {ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(DRAFT_KEY,userId),JSON.stringify({workout:{...workout,updatedAt},updatedAt} satisfies LocalDraftSnapshot));return {ok:true,updatedAt}}catch(error){return {ok:false,updatedAt,error:error instanceof Error?error.message:"Browser storage is full or unavailable."}}}
export function clearLocalDraft(userId?:string|null){if(typeof window!=="undefined")try{window.localStorage.removeItem(accountKey(DRAFT_KEY,userId))}catch{/* A completed cloud save remains authoritative. */}}
export function loadStrengthEditorDraft(userId?:string|null):StrengthEditorDraft|null{if(typeof window==="undefined")return null;try{const value=window.localStorage.getItem(accountKey(STRENGTH_EDITOR_DRAFT_KEY,userId));return value?JSON.parse(value) as StrengthEditorDraft:null}catch{return null}}
export function saveStrengthEditorDraft(template:Template,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(STRENGTH_EDITOR_DRAFT_KEY,userId),JSON.stringify({template,updatedAt} satisfies StrengthEditorDraft));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"The workout edit could not be saved on this device."}}}
export function clearStrengthEditorDraft(userId?:string|null){if(typeof window!=="undefined")try{window.localStorage.removeItem(accountKey(STRENGTH_EDITOR_DRAFT_KEY,userId))}catch{/* The user can still close the editor. */}}
export function loadEnduranceEditorDraft(userId?:string|null):EnduranceEditorDraft|null{if(typeof window==="undefined")return null;try{const value=window.localStorage.getItem(accountKey(ENDURANCE_EDITOR_DRAFT_KEY,userId));return value?JSON.parse(value) as EnduranceEditorDraft:null}catch{return null}}
export function saveEnduranceEditorDraft(mode:EnduranceEditorDraft["mode"],value:EnduranceEditorDraft["value"],userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(ENDURANCE_EDITOR_DRAFT_KEY,userId),JSON.stringify({mode,value,updatedAt} satisfies EnduranceEditorDraft));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"The endurance edit could not be saved on this device."}}}
export function clearEnduranceEditorDraft(userId?:string|null){if(typeof window!=="undefined")try{window.localStorage.removeItem(accountKey(ENDURANCE_EDITOR_DRAFT_KEY,userId))}catch{/* The user can still close the editor. */}}
export function loadCompletedWorkoutEditorDraft(userId?:string|null):CompletedWorkoutEditorDraft|null{if(typeof window==="undefined")return null;try{const value=window.localStorage.getItem(accountKey(COMPLETED_WORKOUT_EDITOR_DRAFT_KEY,userId));return value?JSON.parse(value) as CompletedWorkoutEditorDraft:null}catch{return null}}
export function saveCompletedWorkoutEditorDraft(workout:Workout,editingWorkoutId:string,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(COMPLETED_WORKOUT_EDITOR_DRAFT_KEY,userId),JSON.stringify({workout,editingWorkoutId,updatedAt} satisfies CompletedWorkoutEditorDraft));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"The completed workout edit could not be saved on this device."}}}
export function clearCompletedWorkoutEditorDraft(userId?:string|null){if(typeof window!=="undefined")try{window.localStorage.removeItem(accountKey(COMPLETED_WORKOUT_EDITOR_DRAFT_KEY,userId))}catch{/* The saved completed workout remains unchanged. */}}
const operationPrefix=(userId?:string|null)=>`${accountKey(PENDING_OPERATION_KEY,userId)}:`;
const operationStorageKey=(operationId:string,userId?:string|null)=>`${operationPrefix(userId)}${operationId}`;
const RECOVERY_BACKUP_KEY="setra-recovery-backups-v1";
export function loadLocalWriteVersions(userId?:string|null):Record<string,number>{if(typeof window==="undefined")return{};try{const raw=window.localStorage.getItem(accountKey(WRITE_VERSIONS_KEY,userId));return raw?JSON.parse(raw) as Record<string,number>:{}}catch{return{}}}
export function saveLocalWriteVersions(versions:Record<string,number>,userId?:string|null){if(typeof window!=="undefined")try{window.localStorage.setItem(accountKey(WRITE_VERSIONS_KEY,userId),JSON.stringify(versions))}catch{/* A later cloud refresh can restore versions. */}}
export function recordAcceptedWrite(key:string,version:number,userId?:string|null){if(!Number.isSafeInteger(version)||version<0)return;const versions=loadLocalWriteVersions(userId);versions[key]=Math.max(versions[key]||0,version);saveLocalWriteVersions(versions,userId)}
function loadAllPendingDiaryChanges(userId?:string|null):PendingDiaryChange[]{
  if(typeof window==="undefined")return[];
  const legacyKey=accountKey(PENDING_CHANGES_KEY,userId);
  const legacyRaw=window.localStorage.getItem(legacyKey);
  const legacy=(legacyRaw?normalizePendingChanges(JSON.parse(legacyRaw) as PendingDiaryChange[]):[]).map(item=>({...item,expectedVersion:(item as PendingDiaryChange).expectedVersion??0,protocolVersion:undefined})) as PendingDiaryChange[];
  const operations:PendingDiaryChange[]=[];
  const prefix=operationPrefix(userId);
  for(let index=0;index<window.localStorage.length;index++){
    const key=window.localStorage.key(index);
    if(!key?.startsWith(prefix))continue;
    const raw=window.localStorage.getItem(key);
    if(!raw)continue;
    const operation=JSON.parse(raw) as PendingDiaryChange;
    operations.push(operation);
  }
  // Move the old single-array queue into independent records before deleting it.
  // This preserves unrelated legacy edits when a new write is queued or another
  // operation is acknowledged during a rolling deployment.
  const merged=mergeUniqueOperations(legacy,operations);
  const knownOperationIds=new Set(operations.map(item=>item.operationId));
  for(const operation of merged){
    if(knownOperationIds.has(operation.operationId))continue;
    window.localStorage.setItem(operationStorageKey(operation.operationId,userId),JSON.stringify(operation));
    knownOperationIds.add(operation.operationId);
  }
  if(legacyRaw)window.localStorage.removeItem(legacyKey);
  return merged;
}
export function loadPendingDiaryChanges(userId?:string|null):PendingDiaryChange[]{if(typeof window==="undefined")return[];try{return selectDurablePendingLeaves(loadAllPendingDiaryChanges(userId))}catch{return[]}}
export function queuePendingDiaryChange(change:PendingDiaryChangeInput,userId?:string|null):PendingQueueResult{const updatedAt=new Date().toISOString();const operationId=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;const current=typeof window==="undefined"?[]:loadPendingDiaryChanges(userId);const revision=nextRevision(current,change.key);const parent=current.filter(item=>item.key===change.key).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.operationId.localeCompare(b.operationId)).at(-1);const expectedVersion=parent?.expectedVersion??loadLocalWriteVersions(userId)[change.key]??0;const result={ok:false,updatedAt,key:change.key,operationId,revision,expectedVersion,protocolVersion:2 as const};if(typeof window==="undefined")return{...result,error:"Browser storage is unavailable."};try{const pending={...change,operationId,revision,expectedVersion,protocolVersion:2 as const,updatedAt,supersedesOperationId:parent?.operationId} as PendingDiaryChange;window.localStorage.setItem(operationStorageKey(operationId,userId),JSON.stringify(pending));window.localStorage.removeItem(accountKey(PENDING_CHANGES_KEY,userId));return{...result,ok:true}}catch(error){return{...result,error:error instanceof Error?error.message:"Pending changes could not be stored."}}}
export function removePendingDiaryChange(key:string,operationId:string,userId?:string|null,resultingVersion?:number):LocalWriteResult{
  const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};
  try{
    const all=loadAllPendingDiaryChanges(userId);const byId=new Map(all.map(item=>[item.operationId,item]));const acknowledged=new Set<string>();let cursor=byId.get(operationId);
    while(cursor&&cursor.key===key&&!acknowledged.has(cursor.operationId)){acknowledged.add(cursor.operationId);cursor=cursor.supersedesOperationId?byId.get(cursor.supersedesOperationId):undefined}
    // Rebase surviving descendants and persist the accepted version before removing
    // the acknowledged records. If any write fails, every acknowledged operation is
    // still present and can safely be replayed using its stable operation ID.
    if(resultingVersion!=null){
      const replacements:PendingDiaryChange[]=[];
      for(const item of all.filter(item=>item.key===key&&!acknowledged.has(item.operationId))){let ancestor=item.supersedesOperationId?byId.get(item.supersedesOperationId):undefined;let followsAcknowledged=Boolean(item.supersedesOperationId&&acknowledged.has(item.supersedesOperationId));const seen=new Set<string>();while(ancestor&&!followsAcknowledged&&!seen.has(ancestor.operationId)){seen.add(ancestor.operationId);followsAcknowledged=acknowledged.has(ancestor.operationId);ancestor=ancestor.supersedesOperationId?byId.get(ancestor.supersedesOperationId):undefined}if(followsAcknowledged)replacements.push({...item,expectedVersion:resultingVersion,failure:undefined,supersedesOperationId:undefined})}
      for(const replacement of replacements)window.localStorage.setItem(operationStorageKey(replacement.operationId,userId),JSON.stringify(replacement));
      const versions=loadLocalWriteVersions(userId);versions[key]=Math.max(versions[key]||0,resultingVersion);window.localStorage.setItem(accountKey(WRITE_VERSIONS_KEY,userId),JSON.stringify(versions));
    }
    for(const id of acknowledged)window.localStorage.removeItem(operationStorageKey(id,userId));window.localStorage.removeItem(accountKey(PENDING_CHANGES_KEY,userId));return{ok:true,updatedAt};
  }catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"The pending change could not be removed."}}
}
export function backupPendingDiaryChange(change:PendingDiaryChange,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{const key=accountKey(RECOVERY_BACKUP_KEY,userId);const existing=JSON.parse(window.localStorage.getItem(key)||"[]") as PendingDiaryChange[];const next=[change,...existing.filter(item=>item.operationId!==change.operationId)].slice(0,20);window.localStorage.setItem(key,JSON.stringify(next));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"A recovery backup could not be stored."}}}
export function loadRecoveryBackups(userId?:string|null):PendingDiaryChange[]{if(typeof window==="undefined")return[];try{return JSON.parse(window.localStorage.getItem(accountKey(RECOVERY_BACKUP_KEY,userId))||"[]") as PendingDiaryChange[]}catch{return[]}}
export function removeRecoveryBackup(operationId:string,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{const key=accountKey(RECOVERY_BACKUP_KEY,userId);window.localStorage.setItem(key,JSON.stringify(loadRecoveryBackups(userId).filter(item=>item.operationId!==operationId)));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"The recovery backup could not be removed."}}}
export function markPendingDiaryFailure(operationId:string,failure:PendingFailure,userId?:string|null){if(typeof window==="undefined")return;try{const key=operationStorageKey(operationId,userId);const raw=window.localStorage.getItem(key);if(!raw)return;window.localStorage.setItem(key,JSON.stringify({...JSON.parse(raw),failure}))}catch{/* Preserve the original operation if metadata cannot be updated. */}}
export function clearPendingDiaryFailure(operationId:string,userId?:string|null){if(typeof window==="undefined")return;try{const key=operationStorageKey(operationId,userId);const raw=window.localStorage.getItem(key);if(!raw)return;const value=JSON.parse(raw);delete value.failure;window.localStorage.setItem(key,JSON.stringify(value))}catch{/* The recovery action can be tried again. */}}
export function canImportLegacyDiary(userId:string){if(typeof window==="undefined")return false;const owner=window.localStorage.getItem(OWNER_KEY);return !owner||owner===userId}
export function claimLegacyDiary(userId:string){if(typeof window!=="undefined")window.localStorage.setItem(OWNER_KEY,userId)}
export function loadLocalAppColour(userId?:string|null){if(typeof window==="undefined")return null;return window.localStorage.getItem(accountKey(APP_COLOUR_KEY,userId))}
export function saveLocalAppColour(colour:string,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(APP_COLOUR_KEY,userId),colour)}
export function loadLocalAppearance(userId?:string|null):AppearanceMode|null{if(typeof window==="undefined")return null;const value=window.localStorage.getItem(accountKey(APPEARANCE_KEY,userId));return value==="light"||value==="dark"||value==="system"?value:null}
export function saveLocalAppearance(mode:AppearanceMode,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(APPEARANCE_KEY,userId),mode)}
export function loadLocalTextScale(userId?:string|null):TextScale|null{if(typeof window==="undefined")return null;const value=Number(window.localStorage.getItem(accountKey(TEXT_SCALE_KEY,userId)));return value===1||value===1.1||value===1.2||value===1.3?value:null}
export function saveLocalTextScale(scale:TextScale,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(TEXT_SCALE_KEY,userId),String(scale))}
export function loadLocalEnduranceSessions(userId?:string|null):EnduranceSession[]{if(typeof window==="undefined")return [];try{const value=window.localStorage.getItem(accountKey(ENDURANCE_KEY,userId));return value?JSON.parse(value) as EnduranceSession[]:[]}catch{return []}}
export function saveLocalEnduranceSessions(sessions:EnduranceSession[],userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(ENDURANCE_KEY,userId),JSON.stringify(sessions));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"Browser storage is full or unavailable."}}}
export function loadLocalEnduranceTemplates(userId?:string|null):EnduranceTemplate[]{if(typeof window==="undefined")return [];try{const value=window.localStorage.getItem(accountKey(ENDURANCE_TEMPLATES_KEY,userId));return value?JSON.parse(value) as EnduranceTemplate[]:[]}catch{return []}}
export function saveLocalEnduranceTemplates(templates:EnduranceTemplate[],userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{window.localStorage.setItem(accountKey(ENDURANCE_TEMPLATES_KEY,userId),JSON.stringify(templates));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"Browser storage is full or unavailable."}}}

export function localImportSummary(data:AppData){
  const workouts=data.workouts.filter(workout=>!workout.id.startsWith("sample-"));
  return {templates:data.templates.length,scheduled:data.scheduled.length,workouts,workoutCount:workouts.length,sets:workouts.reduce((total,workout)=>total+workout.exercises.reduce((exerciseTotal,exercise)=>exerciseTotal+exercise.sets.length,0),0)};
}

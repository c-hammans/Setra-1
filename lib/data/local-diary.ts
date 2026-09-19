import type { AppData, EnduranceSession, EnduranceTemplate, Template, Workout } from "@/lib/setra/types";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";

const DIARY_KEY="form-strength-diary";
const DRAFT_KEY="form-active-workout";
const OWNER_KEY="form-strength-diary-owner";
const APP_COLOUR_KEY="form-app-colour";
const APPEARANCE_KEY="form-appearance";
const TEXT_SCALE_KEY="form-text-scale";
const ENDURANCE_KEY="form-endurance-sessions";
const ENDURANCE_TEMPLATES_KEY="form-endurance-templates";
const PENDING_CHANGES_KEY="form-pending-diary-changes";
const STRENGTH_EDITOR_DRAFT_KEY="form-strength-editor-draft";
const ENDURANCE_EDITOR_DRAFT_KEY="form-endurance-editor-draft";
const COMPLETED_WORKOUT_EDITOR_DRAFT_KEY="form-completed-workout-editor-draft";
const accountKey=(base:string,userId?:string|null)=>userId?`${base}:${userId}`:base;
export type LocalWriteResult={ok:boolean;updatedAt:string;error?:string};
export type LocalDraftSnapshot={workout:Workout;updatedAt:string};
export type StrengthEditorDraft={template:Template;updatedAt:string};
export type EnduranceEditorDraft={mode:"template"|"plan"|"log";value:EnduranceSession|EnduranceTemplate;updatedAt:string};
export type CompletedWorkoutEditorDraft={workout:Workout;editingWorkoutId:string;updatedAt:string};
export type PendingDiaryChange=
  |{key:string;kind:"save_workout";updatedAt:string;payload:{workout:Workout;status:"in_progress"|"completed"}}
  |{key:string;kind:"replace_schedule";updatedAt:string;payload:{items:AppData["scheduled"]}}
  |{key:string;kind:"save_strength_template";updatedAt:string;payload:{template:Template}}
  |{key:string;kind:"save_endurance_session";updatedAt:string;payload:{session:EnduranceSession}}
  |{key:string;kind:"save_endurance_template";updatedAt:string;payload:{template:EnduranceTemplate}};
type PendingDiaryChangeInput=
  |{key:string;kind:"save_workout";payload:{workout:Workout;status:"in_progress"|"completed"}}
  |{key:string;kind:"replace_schedule";payload:{items:AppData["scheduled"]}}
  |{key:string;kind:"save_strength_template";payload:{template:Template}}
  |{key:string;kind:"save_endurance_session";payload:{session:EnduranceSession}}
  |{key:string;kind:"save_endurance_template";payload:{template:EnduranceTemplate}};

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
export function loadPendingDiaryChanges(userId?:string|null):PendingDiaryChange[]{if(typeof window==="undefined")return[];try{const value=window.localStorage.getItem(accountKey(PENDING_CHANGES_KEY,userId));return value?JSON.parse(value) as PendingDiaryChange[]:[]}catch{return[]}}
export function queuePendingDiaryChange(change:PendingDiaryChangeInput,userId?:string|null):LocalWriteResult{const updatedAt=new Date().toISOString();if(typeof window==="undefined")return{ok:false,updatedAt,error:"Browser storage is unavailable."};try{const current=loadPendingDiaryChanges(userId).filter(item=>item.key!==change.key);window.localStorage.setItem(accountKey(PENDING_CHANGES_KEY,userId),JSON.stringify([...current,{...change,updatedAt}]));return{ok:true,updatedAt}}catch(error){return{ok:false,updatedAt,error:error instanceof Error?error.message:"Pending changes could not be stored."}}}
export function removePendingDiaryChange(key:string,userId?:string|null){if(typeof window==="undefined")return;try{const next=loadPendingDiaryChanges(userId).filter(item=>item.key!==key);if(next.length)window.localStorage.setItem(accountKey(PENDING_CHANGES_KEY,userId),JSON.stringify(next));else window.localStorage.removeItem(accountKey(PENDING_CHANGES_KEY,userId))}catch{/* Keep the queue if storage cannot be updated. */}}
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

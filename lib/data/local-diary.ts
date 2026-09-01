import type { AppData, EnduranceSession, Workout } from "@/lib/setra/types";
import type {AppearanceMode,TextScale} from "@/lib/setra/appearance";

const DIARY_KEY="form-strength-diary";
const DRAFT_KEY="form-active-workout";
const OWNER_KEY="form-strength-diary-owner";
const APP_COLOUR_KEY="form-app-colour";
const APPEARANCE_KEY="form-appearance";
const TEXT_SCALE_KEY="form-text-scale";
const ENDURANCE_KEY="form-endurance-sessions";
const accountKey=(base:string,userId?:string|null)=>userId?`${base}:${userId}`:base;

export function loadLocalDiary(userId?:string|null):AppData|null{
  if(typeof window==="undefined")return null;
  try{const value=window.localStorage.getItem(accountKey(DIARY_KEY,userId));return value?JSON.parse(value) as AppData:null}catch{return null}
}
export function saveLocalDiary(data:AppData,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(DIARY_KEY,userId),JSON.stringify(data))}
export function loadLocalDraft(userId?:string|null):Workout|null{if(typeof window==="undefined")return null;try{const value=window.localStorage.getItem(accountKey(DRAFT_KEY,userId));return value?JSON.parse(value) as Workout:null}catch{return null}}
export function saveLocalDraft(workout:Workout,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(DRAFT_KEY,userId),JSON.stringify(workout))}
export function clearLocalDraft(userId?:string|null){if(typeof window!=="undefined")window.localStorage.removeItem(accountKey(DRAFT_KEY,userId))}
export function canImportLegacyDiary(userId:string){if(typeof window==="undefined")return false;const owner=window.localStorage.getItem(OWNER_KEY);return !owner||owner===userId}
export function claimLegacyDiary(userId:string){if(typeof window!=="undefined")window.localStorage.setItem(OWNER_KEY,userId)}
export function loadLocalAppColour(userId?:string|null){if(typeof window==="undefined")return null;return window.localStorage.getItem(accountKey(APP_COLOUR_KEY,userId))}
export function saveLocalAppColour(colour:string,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(APP_COLOUR_KEY,userId),colour)}
export function loadLocalAppearance(userId?:string|null):AppearanceMode|null{if(typeof window==="undefined")return null;const value=window.localStorage.getItem(accountKey(APPEARANCE_KEY,userId));return value==="light"||value==="dark"||value==="system"?value:null}
export function saveLocalAppearance(mode:AppearanceMode,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(APPEARANCE_KEY,userId),mode)}
export function loadLocalTextScale(userId?:string|null):TextScale|null{if(typeof window==="undefined")return null;const value=Number(window.localStorage.getItem(accountKey(TEXT_SCALE_KEY,userId)));return value===1||value===1.1||value===1.2||value===1.3?value:null}
export function saveLocalTextScale(scale:TextScale,userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(TEXT_SCALE_KEY,userId),String(scale))}
export function loadLocalEnduranceSessions(userId?:string|null):EnduranceSession[]{if(typeof window==="undefined")return [];try{const value=window.localStorage.getItem(accountKey(ENDURANCE_KEY,userId));return value?JSON.parse(value) as EnduranceSession[]:[]}catch{return []}}
export function saveLocalEnduranceSessions(sessions:EnduranceSession[],userId?:string|null){if(typeof window!=="undefined")window.localStorage.setItem(accountKey(ENDURANCE_KEY,userId),JSON.stringify(sessions))}

export function localImportSummary(data:AppData){
  const workouts=data.workouts.filter(workout=>!workout.id.startsWith("sample-"));
  return {templates:data.templates.length,scheduled:data.scheduled.length,workouts,workoutCount:workouts.length,sets:workouts.reduce((total,workout)=>total+workout.exercises.reduce((exerciseTotal,exercise)=>exerciseTotal+exercise.sets.length,0),0)};
}

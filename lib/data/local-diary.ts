import type { AppData, Workout } from "@/lib/setra/types";

const DIARY_KEY="form-strength-diary";
const DRAFT_KEY="form-active-workout";
const OWNER_KEY="form-strength-diary-owner";
const APP_COLOUR_KEY="form-app-colour";
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

export function localImportSummary(data:AppData){
  const workouts=data.workouts.filter(workout=>!workout.id.startsWith("sample-"));
  return {templates:data.templates.length,scheduled:data.scheduled.length,workouts,workoutCount:workouts.length,sets:workouts.reduce((total,workout)=>total+workout.exercises.reduce((exerciseTotal,exercise)=>exerciseTotal+exercise.sets.length,0),0)};
}

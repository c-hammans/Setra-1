import type {Template,Workout,WorkoutExercise} from "./types";

/** A client-generated identity that is independent of collection size or ordering. */
export function createWorkoutId(prefix="workout"){
  const value=typeof crypto!=="undefined"&&"randomUUID" in crypto
    ?crypto.randomUUID()
    :`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}
export const createRecordId=createWorkoutId;

export function newTemplateWorkout(template:Template,date:string,startedAt:string,exercises:WorkoutExercise[],id=createWorkoutId()):Workout{return{id,templateId:template.id,name:template.name,date,startedAt,duration:0,note:"",supersetNames:template.supersetNames,warmup:(template.warmup||[]).map(item=>({...item,done:false})),exercises}}
export function newBlankWorkout(date:string,startedAt:string,id=createWorkoutId()):Workout{return{id,name:"Add as I go",date,startedAt,duration:0,note:"",warmup:[],exercises:[]}}

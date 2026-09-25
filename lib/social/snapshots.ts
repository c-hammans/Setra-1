import type {EnduranceSession,EnduranceTemplate,Exercise,Template,Workout} from "../setra/types.ts";
import type {SocialShareDraft} from "./types.ts";

const exerciseMap=(exercises:Exercise[])=>new Map(exercises.map(item=>[item.id,item]));
export function strengthWorkoutSnapshot(workout:Workout,exercises:Exercise[]):SocialShareDraft{
  const catalogue=exerciseMap(exercises);
  return {itemType:"strength_workout",sourceClientId:workout.id,title:workout.name,snapshot:{version:1,modality:"strength",name:workout.name,date:workout.date,duration:workout.duration,exercises:workout.exercises.filter(item=>!item.skipped&&item.sets.some(set=>set.done)).map(item=>({exerciseId:item.exerciseId,exerciseName:catalogue.get(item.exerciseId)?.name||"Exercise",loadMode:item.loadMode,repTarget:item.repTarget,sets:item.sets.filter(set=>set.done).map(set=>({weight:set.weight,reps:set.reps,rpe:set.rpe}))}))}};
}
export function enduranceWorkoutSnapshot(session:EnduranceSession):SocialShareDraft{
  return {itemType:"endurance_workout",sourceClientId:session.id,title:session.title,snapshot:{version:1,modality:"endurance",activityType:session.activityType,title:session.title,date:session.date,durationMinutes:session.durationMinutes,distanceKm:session.distanceKm,averagePaceSecondsPerKm:session.averagePaceSecondsPerKm,averageSpeedKph:session.averageSpeedKph,averageSplitSecondsPer500m:session.averageSplitSecondsPer500m,rpe:session.rpe,blocks:session.blocks}};
}
export function strengthTemplateSnapshot(template:Template,exercises:Exercise[]):SocialShareDraft{
  const catalogue=exerciseMap(exercises);
  return {itemType:"strength_template",sourceClientId:template.id,title:template.name,snapshot:{version:1,modality:"strength",name:template.name,focus:template.focus,warmup:template.warmup||[],supersetNames:template.supersetNames||{},exercises:template.exercises.map(item=>({...item,exerciseName:catalogue.get(item.exerciseId)?.name||"Exercise"}))}};
}
export function enduranceTemplateSnapshot(template:EnduranceTemplate):SocialShareDraft{
  return {itemType:"endurance_template",sourceClientId:template.id,title:template.title,snapshot:{version:1,modality:"endurance",activityType:template.activityType,title:template.title,plannedDurationMinutes:template.plannedDurationMinutes,plannedDistanceKm:template.plannedDistanceKm,targetRpe:template.targetRpe,environment:template.environment,category:template.category,blocks:template.blocks}};
}

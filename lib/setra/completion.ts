import type {Workout} from "./types.ts";

export type StrengthCompletion={status:"empty"|"partial"|"complete";completedSets:number;plannedSets:number;skippedExercises:number;completedExercises:number};

export function strengthCompletion(workout:Workout):StrengthCompletion{
  const completedSets=workout.exercises.reduce((sum,exercise)=>sum+(exercise.skipped?0:exercise.sets.filter(set=>set.done).length),0);
  const plannedSets=workout.exercises.reduce((sum,exercise)=>sum+(exercise.skipped?0:exercise.sets.length),0);
  const skippedExercises=workout.exercises.filter(exercise=>exercise.skipped).length;
  const completedExercises=workout.exercises.filter(exercise=>!exercise.skipped&&exercise.sets.some(set=>set.done)).length;
  const status=completedSets===0?"empty":completedSets===plannedSets&&skippedExercises===0?"complete":"partial";
  return {status,completedSets,plannedSets,skippedExercises,completedExercises};
}

// Partial sessions count as genuine training once at least one set is complete,
// but they do not satisfy full-plan adherence. This distinction is used by
// History/session goals versus planned-week completion.
export const countsAsTrainingSession=(workout:Workout)=>strengthCompletion(workout).status!=="empty";
export const satisfiesPlannedSession=(workout:Workout)=>strengthCompletion(workout).status==="complete";

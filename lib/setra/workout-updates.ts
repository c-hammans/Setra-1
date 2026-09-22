import type {SetLog,Workout} from "./types.ts";

export function applyPreviousSetValues(
  workout:Workout,
  exerciseIndex:number,
  setIndex:number,
  previous:Pick<SetLog,"weight"|"reps">,
):Workout{
  return {
    ...workout,
    exercises:workout.exercises.map((exercise,currentExercise)=>currentExercise===exerciseIndex?{
      ...exercise,
      sets:exercise.sets.map((set,currentSet)=>currentSet===setIndex?{
        ...set,
        weight:previous.weight,
        reps:previous.reps,
        // Copying a prescription does not claim that the set was performed.
        done:false,
      }:set),
    }:exercise),
  };
}

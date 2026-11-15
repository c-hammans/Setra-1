import type { Workout } from "@/lib/setra/types";

export type PlannedWorkoutProgressPreference = "sets" | "percentage";

export type WorkoutProgress = {
  completedSets: number;
  plannedSets: number;
  percentage: number;
};

export function workoutProgress(workout: Workout): WorkoutProgress {
  const included = workout.exercises.filter((exercise) => !exercise.skipped);
  const completedSets = included.reduce(
    (sum, exercise) =>
      sum + exercise.sets.filter((set) => set.done).length,
    0,
  );
  const plannedSets = included.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );
  return {
    completedSets,
    plannedSets,
    percentage: plannedSets
      ? Math.round((completedSets / plannedSets) * 100)
      : 0,
  };
}

export function workoutProgressLabel(
  workout: Workout,
  preference: PlannedWorkoutProgressPreference,
) {
  const progress = workoutProgress(workout);
  if (workout.templateId && preference === "percentage")
    return `${progress.percentage}% of planned session complete`;
  if (workout.templateId)
    return `${progress.completedSets} of ${progress.plannedSets} planned sets`;
  return `${progress.completedSets} / ${progress.plannedSets} sets`;
}

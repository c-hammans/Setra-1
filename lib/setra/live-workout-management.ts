import type { ScheduledWorkout, Workout } from "@/lib/setra/types";

export function reorderLiveWorkoutExercises(
  workout: Workout,
  from: number,
  to: number,
): Workout {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= workout.exercises.length ||
    to >= workout.exercises.length
  )
    return workout;
  const exercises = [...workout.exercises];
  const [moved] = exercises.splice(from, 1);
  exercises.splice(to, 0, moved);
  return { ...workout, exercises };
}

export function removeLiveWorkoutExercise(
  workout: Workout,
  index: number,
): Workout {
  const removedGroup = workout.exercises[index]?.group;
  if (!workout.exercises[index]) return workout;
  const exercises = workout.exercises
    .filter((_, exerciseIndex) => exerciseIndex !== index)
    .map((exercise) => ({ ...exercise }));
  const supersetNames = { ...workout.supersetNames };
  if (
    removedGroup &&
    exercises.filter((exercise) => exercise.group === removedGroup).length < 2
  ) {
    exercises.forEach((exercise) => {
      if (exercise.group === removedGroup) delete exercise.group;
    });
    delete supersetNames[removedGroup];
  }
  return { ...workout, exercises, supersetNames };
}

export function moveScheduledWorkout(
  scheduled: ScheduledWorkout[],
  target: { date: string; templateId: string },
  nextDate: string,
): ScheduledWorkout[] | null {
  if (nextDate === target.date) return scheduled;
  if (
    scheduled.some(
      (item) => item.date === nextDate && item.templateId === target.templateId,
    )
  )
    return null;
  let found = false;
  const next = scheduled.map((item) => {
    if (item.date !== target.date || item.templateId !== target.templateId)
      return item;
    found = true;
    return { ...item, date: nextDate };
  });
  return found ? next : null;
}

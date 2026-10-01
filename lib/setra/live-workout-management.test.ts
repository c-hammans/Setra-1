import test from "node:test";
import assert from "node:assert/strict";
import type { Workout } from "./types.ts";
import {
  moveScheduledWorkout,
  removeLiveWorkoutExercise,
  reorderLiveWorkoutExercises,
} from "./live-workout-management.ts";

const workout: Workout = {
  id: "live-1",
  name: "Upper Body",
  date: "2026-10-01",
  startedAt: "09:00",
  duration: 0,
  note: "",
  supersetNames: { pair: "Push and pull" },
  exercises: [
    {
      exerciseId: "press",
      group: "pair",
      note: "keep elbows in",
      sets: [{ reps: "8", weight: "40", rpe: "7", done: true }],
    },
    {
      exerciseId: "row",
      group: "pair",
      note: "",
      sets: [{ reps: "10", weight: "50", rpe: "8", done: false }],
    },
    {
      exerciseId: "curl",
      note: "",
      sets: [{ reps: "12", weight: "10", rpe: "", done: false }],
    },
  ],
};

test("reorders live exercises without changing entered set data or groups", () => {
  const reordered = reorderLiveWorkoutExercises(workout, 2, 0);
  assert.deepEqual(
    reordered.exercises.map((item) => item.exerciseId),
    ["curl", "press", "row"],
  );
  assert.deepEqual(reordered.exercises[1].sets[0], workout.exercises[0].sets[0]);
  assert.equal(reordered.exercises[1].group, "pair");
  assert.equal(reordered.supersetNames?.pair, "Push and pull");
});

test("removes only the live exercise and cleans up an orphaned superset", () => {
  const updated = removeLiveWorkoutExercise(workout, 0);
  assert.deepEqual(
    updated.exercises.map((item) => item.exerciseId),
    ["row", "curl"],
  );
  assert.equal(updated.exercises[0].group, undefined);
  assert.equal(updated.supersetNames?.pair, undefined);
  assert.equal(workout.exercises.length, 3);
});

test("moves the existing planned occurrence and preserves its state", () => {
  const moved = moveScheduledWorkout(
    [
      { date: "2026-10-05", templateId: "upper", skipped: false },
      { date: "2026-10-07", templateId: "lower" },
    ],
    { date: "2026-10-05", templateId: "upper" },
    "2026-10-06",
  );
  assert.deepEqual(moved, [
    { date: "2026-10-06", templateId: "upper", skipped: false },
    { date: "2026-10-07", templateId: "lower" },
  ]);
});

test("does not duplicate a template on a date where it is already planned", () => {
  assert.equal(
    moveScheduledWorkout(
      [
        { date: "2026-10-05", templateId: "upper" },
        { date: "2026-10-06", templateId: "upper" },
      ],
      { date: "2026-10-05", templateId: "upper" },
      "2026-10-06",
    ),
    null,
  );
});

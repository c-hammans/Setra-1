import assert from "node:assert/strict";
import test from "node:test";
import type { Workout } from "./types.ts";
import {
  workoutProgress,
  workoutProgressLabel,
} from "./planned-workout-progress.ts";

const planned: Workout = {
  id: "planned",
  templateId: "upper",
  name: "Upper Body",
  date: "2026-11-15",
  startedAt: "08:00",
  duration: 0,
  note: "",
  exercises: [
    {
      exerciseId: "press",
      note: "",
      sets: [
        { weight: "40", reps: "8", rpe: "", done: true },
        { weight: "40", reps: "8", rpe: "", done: false },
        { weight: "40", reps: "8", rpe: "", done: false },
      ],
    },
    {
      exerciseId: "row",
      note: "",
      skipped: true,
      sets: [{ weight: "40", reps: "8", rpe: "", done: false }],
    },
  ],
};

test("planned workout progress uses one current non-skipped set total", () => {
  assert.deepEqual(workoutProgress(planned), {
    completedSets: 1,
    plannedSets: 3,
    percentage: 33,
  });
  assert.equal(workoutProgressLabel(planned, "sets"), "1 of 3 planned sets");
  assert.equal(
    workoutProgressLabel(planned, "percentage"),
    "33% of planned session complete",
  );
});

test("add as I go progress ignores the planned display preference", () => {
  const manual = { ...planned, templateId: undefined, name: "Add as I go" };
  assert.equal(workoutProgressLabel(manual, "percentage"), "1 / 3 sets");
});

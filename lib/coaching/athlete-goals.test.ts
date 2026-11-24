import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAthleteGoalProgress,
  formatGoalTime,
  goalProgressLabel,
  goalTargetLabel,
  parseGoalTime,
} from "./athlete-goals.ts";

test("athlete goals parse and format event targets", () => {
  assert.equal(parseGoalTime("19:59"), 1199);
  assert.equal(parseGoalTime("1:02:03"), 3723);
  assert.equal(formatGoalTime(1199), "19:59");
});
test("athlete goals format strength targets and progress", () => {
  const goal = {
    metricType: "strength_load" as const,
    targetValue: 120,
    targetUnit: "kg",
    targetLabel: "Back Squat",
    targetDistanceMetres: null,
    targetText: "",
    currentValue: 110,
  } as never;
  assert.equal(goalTargetLabel(goal), "Back Squat · 120 kg");
  assert.equal(goalProgressLabel(goal), "110 kg → 120 kg");
});
test("athlete goals do not invent progress without a measured value", () => {
  assert.equal(
    goalProgressLabel({ metricType: "custom", currentValue: null } as never),
    "",
  );
});

const goal = (update: Record<string, unknown> = {}) =>
  ({
    id: "goal",
    clientUserId: "client",
    title: "Sub-20 5K",
    goalType: "running",
    targetDate: "2026-12-10",
    metricType: "event_time",
    targetValue: 1199,
    targetUnit: "seconds",
    targetLabel: "",
    targetDistanceMetres: 5000,
    targetText: "",
    notes: "",
    isPrimary: true,
    status: "active",
    approvalStatus: "accepted",
    createdByRole: "client",
    creatorName: "Athlete",
    currentValue: 1242,
    previousValue: 1260,
    currentValueDate: "2026-11-20",
    recentDataCount: 2,
    goalReached: false,
    linkedPrograms: [],
    createdAt: "2026-01-01",
    updatedAt: "2026-11-20",
    ...update,
  }) as never;

test("goal progress calculates time improvement and approaching targets", () => {
  const progress = buildAthleteGoalProgress(
    goal(),
    new Date("2026-11-24T12:00:00"),
  );
  assert.equal(progress.currentLabel, "20:42");
  assert.equal(progress.targetLabel, "5 km · 19:59");
  assert.equal(progress.trendLabel, "0:18 improvement from the earlier best");
  assert.equal(progress.attention, "target_approaching");
});

test("goal progress supports strength and reached states", () => {
  const progress = buildAthleteGoalProgress(
    goal({
      title: "Back Squat 120 kg",
      goalType: "strength",
      metricType: "strength_load",
      targetValue: 120,
      targetUnit: "kg",
      targetLabel: "Back Squat",
      targetDistanceMetres: null,
      currentValue: 122.5,
      previousValue: 112.5,
      goalReached: true,
    }),
    new Date("2026-11-24T12:00:00"),
  );
  assert.equal(progress.currentLabel, "122.5 kg");
  assert.equal(progress.percentage, 100);
  assert.equal(progress.attention, "goal_reached");
});

test("goal progress treats distance as a best single-session value", () => {
  const progress = buildAthleteGoalProgress(
    goal({
      title: "Run 20 km",
      metricType: "distance",
      targetValue: 20000,
      targetUnit: "metres",
      targetDistanceMetres: null,
      currentValue: 15000,
      previousValue: 12000,
      goalReached: false,
      targetDate: null,
    }),
  );
  assert.equal(progress.currentLabel, "15 km");
  assert.equal(progress.percentage, 75);
});

test("custom goals return unavailable without invented progress", () => {
  const progress = buildAthleteGoalProgress(
    goal({
      metricType: "custom",
      targetValue: null,
      targetText: "Build consistency",
      currentValue: null,
      previousValue: null,
      targetDate: null,
    }),
  );
  assert.equal(progress.available, false);
  assert.equal(progress.attention, null);
});

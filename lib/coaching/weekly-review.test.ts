import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachWeeklyReview } from "./weekly-review.ts";
import type { CoachWeeklyReviewSession } from "./types.ts";

const session = (value: Partial<CoachWeeklyReviewSession> & Pick<CoachWeeklyReviewSession, "id" | "date" | "status">): CoachWeeklyReviewSession => ({
  modality: "strength",
  title: "Session",
  plannedSummary: "3 planned sets",
  activityType: "strength",
  ...value,
});

test("weekly review separates completed, skipped and missed work", () => {
  const review = buildCoachWeeklyReview({
    relationshipId: "relationship",
    weekStart: "2026-11-16",
    today: "2026-11-22",
    sessions: [
      session({ id: "one", date: "2026-11-16", status: "completed", actualSets: 3, actualVolumeKg: 900, actualDurationSeconds: 3600 }),
      session({ id: "two", date: "2026-11-17", status: "skipped" }),
      session({ id: "three", date: "2026-11-18", status: "planned" }),
    ],
  });
  assert.equal(review.completedSessions, 1);
  assert.equal(review.skippedSessions, 1);
  assert.equal(review.missedSessions, 1);
  assert.equal(review.completionRate, 1 / 3);
  assert.equal(review.strengthSets, 3);
  assert.equal(review.strengthVolumeKg, 900);
});

test("weekly review keeps sport totals separate and ignores unavailable metrics", () => {
  const review = buildCoachWeeklyReview({
    relationshipId: "relationship",
    weekStart: "2026-11-16",
    today: "2026-11-18",
    sessions: [
      session({ id: "run", date: "2026-11-16", status: "completed", modality: "endurance", activityType: "run", actualDistanceMetres: 10000, actualDurationSeconds: 3000 }),
      session({ id: "swim", date: "2026-11-17", status: "completed", modality: "endurance", activityType: "swim", actualDistanceMetres: 2000 }),
    ],
  });
  assert.deepEqual(review.sportTotals.map((sport) => [sport.activityType, sport.distanceMetres]), [["run", 10000], ["swim", 2000]]);
  assert.equal(review.totalDurationSeconds, 3000);
});

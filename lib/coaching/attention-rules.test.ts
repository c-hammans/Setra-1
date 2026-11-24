import assert from "node:assert/strict";
import test from "node:test";
import { coachAttentionLabel, isHighSessionRpe } from "./attention-rules.ts";

test("high session RPE begins at nine", () => {
  assert.equal(isHighSessionRpe(8.5), false);
  assert.equal(isHighSessionRpe(9), true);
  assert.equal(isHighSessionRpe(10), true);
});
test("attention labels remain neutral and specific", () => {
  assert.equal(coachAttentionLabel("session_overdue"), "Session overdue");
  assert.equal(coachAttentionLabel("high_rpe", 9.5), "RPE 9.5");
  assert.equal(
    coachAttentionLabel("awaiting_coach_review"),
    "Awaiting coach review",
  );
});
test("goal attention labels remain informational", () => {
  assert.equal(coachAttentionLabel("goal_reached"), "Goal reached");
  assert.equal(
    coachAttentionLabel("goal_target_approaching"),
    "Target date approaching",
  );
  assert.equal(
    coachAttentionLabel("goal_limited_data"),
    "Limited recent goal data",
  );
});

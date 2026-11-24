import assert from "node:assert/strict";
import test from "node:test";
import { pushEligibleTypes, safePushPayload } from "./push-delivery.ts";

test("push is limited to high-value event types", () => {
  assert.equal(pushEligibleTypes.has("coach_feedback"), true);
  assert.equal(pushEligibleTypes.has("friend_request"), true);
  assert.equal(pushEligibleTypes.has("planned_session_reminder"), true);
  assert.equal(pushEligibleTypes.has("award_earned"), false);
  assert.equal(pushEligibleTypes.has("athlete_checkin"), false);
});

test("push copy does not expose private feedback content", () => {
  const payload = safePushPayload("coach_feedback", "notice-1", "/coaching/progress");
  assert.equal(payload.body, "Your coach left feedback on your session.");
  assert.equal(payload.url, "/coaching/progress");
});

test("invalid push targets fall back to Notification Centre", () => {
  assert.equal(safePushPayload("friend_request", "notice-2", "https://example.com" ).url, "/notifications");
});

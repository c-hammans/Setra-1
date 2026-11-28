import assert from "node:assert/strict";
import test from "node:test";
import { pushEligibleTypes, safePushPayload } from "./push-delivery.ts";
import { isSupportedPushEndpoint } from "./push-endpoint.ts";

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
  assert.equal(safePushPayload("friend_request", "notice-2", "//example.com" ).url, "/notifications");
});

test("delivery accepts only supported browser push providers",()=>{
  for(const endpoint of ["https://fcm.googleapis.com/fcm/send/example","https://updates.push.services.mozilla.com/push/v1/example","https://web.push.apple.com/example","https://dm3p.notify.windows.com/?token=example"])
    assert.equal(isSupportedPushEndpoint(endpoint),true);
  for(const endpoint of ["https://example.invalid/push","http://fcm.googleapis.com/path","https://fcm.googleapis.com.example.invalid/path","https://fcm.googleapis.com:8443/path",null])
    assert.equal(isSupportedPushEndpoint(endpoint),false);
});

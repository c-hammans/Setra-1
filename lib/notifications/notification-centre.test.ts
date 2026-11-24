import assert from "node:assert/strict";
import test from "node:test";
import { notificationTarget, notificationTime, unreadNotifications } from "./notification-centre.ts";
import type { SetraNotification } from "./types.ts";

const item = (update: Partial<SetraNotification> = {}): SetraNotification => ({
  id: "n1", category: "coaching", type: "coach_feedback", title: "Feedback", body: "Good session",
  createdAt: "2026-11-24T00:00:00Z", updatedAt: "2026-11-24T00:00:00Z", targetPath: "/coaching/progress", ...update,
});

test("unread count ignores read notifications", () => {
  assert.equal(unreadNotifications([item(), item({ id: "n2", readAt: "2026-11-24T01:00:00Z" })]), 1);
});

test("notification targets only allow application paths", () => {
  assert.equal(notificationTarget(item()), "/coaching/progress");
  assert.equal(notificationTarget(item({ targetPath: "https://example.com" })), null);
});

test("notification timestamps remain concise", () => {
  assert.equal(notificationTime("2026-11-24T00:59:00Z", new Date("2026-11-24T01:00:00Z")), "1 min ago");
});

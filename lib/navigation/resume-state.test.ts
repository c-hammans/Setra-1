import assert from "node:assert/strict";
import test from "node:test";
import {
  isRecentNavigationResume,
  mostRecentNavigationResume,
  NAVIGATION_RESUME_WINDOW_MS,
  resumableLocation,
  restoredLocation,
} from "./resume-state.ts";

test("navigation resumes only inside the five minute lifecycle window", () => {
  const now = 1_000_000;
  assert.equal(
    isRecentNavigationResume(
      { location: "/?tab=plan", backgroundedAt: now - 5_000 },
      now,
    ),
    true,
  );
  assert.equal(
    isRecentNavigationResume(
      { location: "/profile", backgroundedAt: now - 120_000 },
      now,
    ),
    true,
  );
  assert.equal(
    isRecentNavigationResume(
      {
        location: "/?tab=history",
        backgroundedAt: now - NAVIGATION_RESUME_WINDOW_MS - 1,
      },
      now,
    ),
    false,
  );
});

test("durable navigation state restores when temporary session state is missing", () => {
  assert.deepEqual(
    mostRecentNavigationResume([
      null,
      { location: "/profile", backgroundedAt: 900 },
    ]),
    { location: "/profile", backgroundedAt: 900 },
  );
  assert.deepEqual(
    mostRecentNavigationResume([
      { location: "/?tab=plan", backgroundedAt: 800 },
      { location: "/?tab=history", backgroundedAt: 1_000 },
    ]),
    { location: "/?tab=history", backgroundedAt: 1_000 },
  );
});

test("live workout view survives selection of the newest resume record", () => {
  assert.deepEqual(
    mostRecentNavigationResume([
      { location: "/", backgroundedAt: 800 },
      {
        location: "/",
        backgroundedAt: 1_000,
        view: "live-workout",
      },
    ]),
    {
      location: "/",
      backgroundedAt: 1_000,
      view: "live-workout",
    },
  );
});

test("only Setra application locations can be resumed", () => {
  assert.equal(resumableLocation("/?tab=plan"), true);
  assert.equal(resumableLocation("/friends"), true);
  assert.equal(resumableLocation("https://example.com"), false);
  assert.equal(resumableLocation("/?tab=unknown"), false);
  assert.equal(resumableLocation("//example.com/notifications"), false);
  assert.equal(resumableLocation("/auth/reset-password"), false);
});

test("short resumes restore coaching and notifications without overriding an explicit link", () => {
  const now = 1_000_000;
  const saved = {location:"/coaching/095d1e25-2500-4a72-9f69-544d62fc0352?view=review",backgroundedAt:now-5000};
  assert.equal(restoredLocation("/",saved,now),saved.location);
  assert.equal(restoredLocation("/notifications",saved,now),null);
  assert.equal(restoredLocation("/",{...saved,location:"/notifications"},now),"/notifications");
  assert.equal(restoredLocation("/",saved,now+NAVIGATION_RESUME_WINDOW_MS),null);
});

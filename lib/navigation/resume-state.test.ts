import assert from "node:assert/strict";
import test from "node:test";
import {
  isRecentNavigationResume,
  mostRecentNavigationResume,
  NAVIGATION_RESUME_WINDOW_MS,
  resumableLocation,
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

test("only Setra application locations can be resumed", () => {
  assert.equal(resumableLocation("/?tab=plan"), true);
  assert.equal(resumableLocation("/friends"), true);
  assert.equal(resumableLocation("https://example.com"), false);
  assert.equal(resumableLocation("/?tab=unknown"), false);
});

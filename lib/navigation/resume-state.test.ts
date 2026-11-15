import assert from "node:assert/strict";
import test from "node:test";
import {
  isRecentNavigationResume,
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

test("only Setra application locations can be resumed", () => {
  assert.equal(resumableLocation("/?tab=plan"), true);
  assert.equal(resumableLocation("/friends"), true);
  assert.equal(resumableLocation("https://example.com"), false);
  assert.equal(resumableLocation("/?tab=unknown"), false);
});

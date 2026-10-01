import assert from "node:assert/strict";
import test from "node:test";
import type { ProfileSettings } from "./profile-service.ts";
import { profileFormIsDirty } from "./profile-form-state.ts";

const baseline: ProfileSettings = {
  displayName: "Charlotte",
  fullName: "Charlotte Hammans",
  dateOfBirth: "",
  bodyWeightKg: "70",
  preferredUnit: "kg",
  trainingGoal: "Build strength",
  experienceLevel: "intermediate",
  trainingPreference: "hybrid",
  appColour: "#409ECE",
  appearanceMode: "system",
  textScale: 1,
  showWorkoutTimingPopup: true,
  showPbPopup: true,
  weekStartsOn: 1,
  lastWeeklyPreviewWeekStart: null,
  weeklySessionGoal: 4,
  awardsTimezone: "Australia/Melbourne",
};

test("profile hydration cannot mark the form dirty before its saved baseline loads", () => {
  assert.equal(
    profileFormIsDirty({ ...baseline, appColour: "#FF6B6B" }, baseline, false),
    false,
  );
});

test("profile edits are dirty only while they differ from the saved baseline", () => {
  const changed = { ...baseline, displayName: "Charlie" };
  assert.equal(profileFormIsDirty(baseline, baseline, true), false);
  assert.equal(profileFormIsDirty(changed, baseline, true), true);
  assert.equal(profileFormIsDirty({ ...changed, displayName: baseline.displayName }, baseline, true), false);
});

test("a successful save establishes the current values as the new baseline", () => {
  const changed = { ...baseline, weeklySessionGoal: 5 };
  assert.equal(profileFormIsDirty(changed, baseline, true), true);
  assert.equal(profileFormIsDirty(changed, changed, true), false);
});

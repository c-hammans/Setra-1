import test from "node:test";
import assert from "node:assert/strict";
import {
  duplicateCoachProgram,
  duplicateEnduranceTemplate,
  duplicateStrengthTemplate,
  libraryMatches,
} from "./library.ts";

test("duplicated templates have independent identities and active library state", () => {
  const strength = duplicateStrengthTemplate({
    id: "strength-one",
    name: "Upper Body",
    focus: "Strength",
    exercises: [{ exerciseId: "bench", sets: 4, reps: "6" }],
    archivedAt: "2026-11-20T00:00:00Z",
  }, "strength-copy");
  const endurance = duplicateEnduranceTemplate({
    id: "run-one",
    title: "Intervals",
    activityType: "run",
    notes: "",
    blocks: [],
    archivedAt: "2026-11-20T00:00:00Z",
  }, "run-copy");
  assert.equal(strength.id, "strength-copy");
  assert.equal(strength.archivedAt, undefined);
  assert.equal(endurance.id, "run-copy");
  assert.equal(endurance.archivedAt, undefined);
});

test("duplicated programs keep structure without sharing source identity", () => {
  const source = {
    id: "program-one",
    name: "Four Week Block",
    description: "",
    durationWeeks: 4,
    focus: "Build",
    createdAt: "2026-11-01",
    updatedAt: "2026-11-20",
    sessions: [{ id: "session-one", weekNumber: 1, dayOffset: 0, position: 0, modality: "strength" as const, templateId: "template", templateName: "Upper", instruction: "" }],
  };
  const copy = duplicateCoachProgram(source, () => "session-copy");
  copy.sessions[0].templateName = "Changed";
  assert.equal(copy.id, "");
  assert.equal(copy.sessions[0].id, "session-copy");
  assert.equal(source.sessions[0].templateName, "Upper");
});

test("library search separates active and archived content", () => {
  assert.equal(libraryMatches("Tempo Run", "tempo", undefined, false), true);
  assert.equal(libraryMatches("Tempo Run", "tempo", "2026-11-20", false), false);
  assert.equal(libraryMatches("Tempo Run", "tempo", "2026-11-20", true), true);
});

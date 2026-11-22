import test from "node:test";
import assert from "node:assert/strict";
import {
  duplicateProgramWeek,
  programSessionDate,
  programWeekForDate,
} from "./programs.ts";
import type { CoachProgramSession } from "./types.ts";

const session: CoachProgramSession = {
  id: "source-session",
  weekNumber: 1,
  dayOffset: 2,
  position: 0,
  modality: "strength",
  templateId: "template",
  templateName: "Upper Strength",
  instruction: "Controlled tempo",
};

test("program sessions map to the correct client week and day", () => {
  assert.equal(programSessionDate("2026-11-16", 1, 0), "2026-11-16");
  assert.equal(programSessionDate("2026-11-16", 3, 5), "2026-12-05");
  assert.equal(programWeekForDate("2026-11-16", "2026-12-05"), 3);
});

test("duplicating a week creates independent program session records", () => {
  const duplicated = duplicateProgramWeek([session], 1, 2, () => "copy-session");
  assert.equal(duplicated.length, 2);
  assert.deepEqual(duplicated[1], {
    ...session,
    id: "copy-session",
    weekNumber: 2,
  });
  assert.equal(duplicated[0].id, "source-session");
});

test("editing a source session does not mutate a captured assignment snapshot", () => {
  const source = { name: "Four Week Block", sessions: [session] };
  const snapshot = structuredClone(source);
  source.sessions[0].templateName = "Updated Template";
  assert.equal(snapshot.sessions[0].templateName, "Upper Strength");
});

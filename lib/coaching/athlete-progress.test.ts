import test from "node:test";
import assert from "node:assert/strict";
import {athleteWeekSummary,nextCoachedSession} from "./athlete-progress.ts";
import type {AthleteCoachingWeekItem} from "./types.ts";

const item=(status:AthleteCoachingWeekItem["status"],date:string,title:string=status):AthleteCoachingWeekItem=>({relationshipId:"relationship",relationshipStatus:"active",coachName:"Coach",occurrenceId:`occurrence-${title}`,assignmentId:`assignment-${title}`,date,modality:"strength",status,title,weekStart:"2026-11-23",weekEnd:"2026-11-29"});

test("athlete adherence keeps completed, skipped and rescheduled states distinct",()=>{
  const summary=athleteWeekSummary([item("completed","2026-11-23"),item("partial","2026-11-24"),item("skipped","2026-11-25"),item("rescheduled","2026-11-26")],"2026-11-27");
  assert.equal(summary.planned,3);assert.equal(summary.completed,2);assert.equal(summary.skipped,1);assert.equal(summary.rescheduled,1);
});

test("next coached session ignores completed work",()=>{
  const next=nextCoachedSession([item("completed","2026-11-24","Done"),item("planned","2026-11-26","Later"),item("planned","2026-11-25","Next")],"2026-11-23");
  assert.equal(next?.title,"Next");
});

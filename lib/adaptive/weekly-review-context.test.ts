import assert from "node:assert/strict";
import test from "node:test";
import {buildWeeklyReviewContext,weeklyReviewSourceHash} from "./weekly-review-context.ts";
import {parseWeeklyReviewContent} from "./weekly-review-schema.ts";

const source=()=>({timezone:"Australia/Melbourne",weekStartsOn:1,weekStart:"2026-11-16",occurrences:[{planned_date:"2026-11-16",status:"completed",modality:"strength"},{planned_date:"2026-11-18",status:"skipped",modality:"endurance"},{planned_date:"2026-11-20",status:"planned",modality:"endurance"}],sessions:[{id:"s1",client_id:"strength-1",modality:"strength",activity_type:"strength",status:"completed",session_date:"2026-11-16",duration_seconds:3600},{id:"e1",client_id:"run-1",modality:"endurance",activity_type:"run",status:"completed",session_date:"2026-11-19",duration_seconds:1800,distance_metres:5000}],workouts:[{workout_date:"2026-11-16",workout_exercises:[{load_mode:"kg",skipped:false,workout_sets:[{completed:true,weight:50,reps:"5"},{completed:false,weight:50,reps:"5"}]}]}],checkIns:[{completed_client_id:"run-1",session_rpe:9,session_feel:"harder",athlete_comment:"Felt harder than expected."}],goals:[{title:"Sub-20 5K",goal_type:"running",status:"active",approval_status:"accepted",target_value:1199,target_unit:"seconds",is_primary:true}],programs:[{name:"5K block",focus:"Steady progression",duration_weeks:8,start_date:"2026-11-02",end_date:"2026-12-27",status:"active"}]});

test("weekly review context covers hybrid adherence, metrics, check-ins, goals and program context",()=>{
  const context=buildWeeklyReviewContext(source());
  assert.equal(context.current.planned,3);assert.equal(context.current.completed,1);assert.equal(context.current.skipped,1);assert.equal(context.current.totalSessions,2);assert.equal(context.current.strengthSets,1);assert.equal(context.current.strengthVolumeKg,250);assert.equal(context.current.enduranceDistanceKm,5);assert.equal(context.current.activityMix.run,1);assert.equal(context.checkIns[0].rpe,9);assert.equal(context.goals[0].title,"Sub-20 5K");assert.equal(context.activeProgram?.currentWeek,3);
});

test("unplanned completed training remains in the weekly review",()=>{
  const value=source();value.occurrences=[];const context=buildWeeklyReviewContext(value);assert.equal(context.current.planned,0);assert.equal(context.current.totalSessions,2);assert.equal(context.current.adherencePercent,null);
});

test("source hashes are stable and change when the underlying training changes",()=>{
  const first=buildWeeklyReviewContext(source());const second=buildWeeklyReviewContext(source());assert.equal(weeklyReviewSourceHash(first),weeklyReviewSourceHash(second));second.current.strengthSets+=1;assert.notEqual(weeklyReviewSourceHash(first),weeklyReviewSourceHash(second));
});

test("structured weekly reviews reject incomplete AI output",()=>{
  const valid={weekAtAGlance:["Two sessions were recorded.","One of three planned sessions was completed."],whatWentWell:["A strength and endurance session were both recorded."],worthNoting:["One session felt harder than expected."],lookingAhead:["Keep the next step conservative."],dataConfidence:{level:"medium",summary:"Duration was available for both sessions.",gaps:[]}};assert.deepEqual(parseWeeklyReviewContent(valid),valid);assert.throws(()=>parseWeeklyReviewContent({...valid,lookingAhead:[]}));
});

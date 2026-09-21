import test from "node:test";
import assert from "node:assert/strict";
import {validateEnduranceRecord} from "./endurance.ts";
import type {EnduranceSession} from "../setra/types.ts";

const session=(patch:Partial<EnduranceSession>={}):EnduranceSession=>({id:"one",activityType:"run",status:"completed",title:"Run",date:"2026-09-19",notes:"",blocks:[],...patch});

test("rejects a negative duration regardless of the visible editor tab",()=>{
  const issues=validateEnduranceRecord(session({durationMinutes:-5}),{today:"2026-09-19"});
  assert.equal(issues.some(issue=>issue.field==="duration"&&issue.tab==="details"),true);
});

test("rejects future completed activities",()=>{
  const issues=validateEnduranceRecord(session({date:"2026-09-20",durationMinutes:30}),{today:"2026-09-19"});
  assert.equal(issues.some(issue=>issue.field==="date"),true);
});

test("requires explicit confirmation for an otherwise empty completed activity",()=>{
  assert.equal(validateEnduranceRecord(session(),{today:"2026-09-19"}).some(issue=>issue.code==="minimal_confirmation"),true);
  assert.equal(validateEnduranceRecord(session(),{today:"2026-09-19",allowMinimalCompleted:true}).length,0);
});

test("zero duration and distance do not bypass minimal-entry confirmation",()=>{
  const issues=validateEnduranceRecord(session({durationMinutes:0,distanceKm:0,startedAt:"09:00"}),{today:"2026-09-19"});
  assert.equal(issues.some(issue=>issue.code==="minimal_confirmation"),true);
});

test("validates nested targets and measured goals",()=>{
  const issues=validateEnduranceRecord(session({durationMinutes:30,blocks:[{id:"step",type:"interval",title:"Work",instructions:"",completionType:"distance",distanceMetres:0,targetMetric:"power",targetMinValue:300,targetMaxValue:250}]}),{today:"2026-09-19"});
  assert.equal(issues.filter(issue=>issue.tab==="structure").length,2);
});

import assert from "node:assert/strict";
import test from "node:test";
import {progressBarPercent,progressCoverage} from "./progress.ts";

test("chart bars scale proportionally instead of capping equal high values",()=>{
  assert.equal(progressBarPercent(0,8),0);
  assert.equal(progressBarPercent(4,8),50);
  assert.equal(progressBarPercent(8,8),100);
});

test("positive single-session weeks remain visible",()=>{
  assert.equal(progressBarPercent(1,20),10);
});

test("duration coverage distinguishes missing values from recorded sessions",()=>{
  assert.deepEqual(progressCoverage([{sessions:2,durationCoverage:1},{sessions:3,durationCoverage:0}]),{sessions:5,durationRecorded:1});
});

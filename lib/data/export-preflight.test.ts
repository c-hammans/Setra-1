import assert from "node:assert/strict";
import test from "node:test";
import {summarizeExportPreflight} from "./export-preflight.ts";

test("marks a fully readable export complete",()=>{
  assert.equal(summarizeExportPreflight([{section:"profile",count:1},{section:"workouts",count:2500}]).complete,true);
});

test("surfaces every failed section before download",()=>{
  const result=summarizeExportPreflight([{section:"profile",count:1},{section:"workouts",count:null,error:"temporarily unavailable"}]);
  assert.equal(result.complete,false);
  assert.deepEqual(result.errors,[{section:"workouts",message:"temporarily unavailable"}]);
});

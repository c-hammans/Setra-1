import assert from "node:assert/strict";
import test from "node:test";
import {parseImportSession} from "./text-parser.ts";
import type {Exercise} from "@/lib/setra/types";

const payload={sourceType:"pasted_text" as const,createdAt:"2026-09-15T00:00:00.000Z"};
const exercises:Exercise[]=[
  {id:"bench",name:"Bench Press",group:"Chest",equipment:"Barbell"},
  {id:"lat",name:"Lat Pulldown",group:"Back",equipment:"Cable"},
  {id:"rdl",name:"Romanian Deadlift",group:"Hamstrings",equipment:"Barbell"},
];

test("parses strength exercises, ranges and supersets",()=>{
  const result=parseImportSession(payload,"Upper Body\nBench Press 4 x 6-8 @ RPE 8\nSuperset A: Pull and press\nLat Pulldown 3 x 10\nRDL 3 x 8",exercises,"strength");
  assert.equal(result.draft.kind,"strength");if(result.draft.kind!=="strength")return;
  assert.equal(result.draft.exercises.length,3);assert.equal(result.draft.exercises[0].reps,"6-8");assert.equal(result.draft.exercises[0].exerciseId,"bench");assert.equal(result.draft.exercises[2].exerciseId,"rdl");assert.equal(result.draft.supersetNames[result.draft.exercises[1].groupKey!],"Pull and press");
});

test("flags an unknown strength exercise instead of silently matching it",()=>{
  const result=parseImportSession(payload,"Strength\nMystery Press 3 x 8",exercises,"strength");if(result.draft.kind!=="strength")return;
  assert.equal(result.draft.exercises[0].exerciseId,undefined);assert.notEqual(result.draft.exercises[0].matchStatus,"matched");
});

test("parses interval and nested-repeat running structure",()=>{
  const result=parseImportSession(payload,"Track Run\n3 x:\n4 x:\n400 m @ 4:00/km\n60 sec recovery\n3 min recovery\nCool-down 2 km easy",[],"endurance");if(result.draft.kind!=="endurance")return;
  const groups=result.draft.template.blocks.filter(block=>block.type==="repeat_group");assert.equal(groups.length,2);assert.equal(groups[1].parentId,groups[0].id);assert.equal(result.draft.template.activityType,"run");
});

test("parses bike power, swim pace and rowing split targets",()=>{
  const bike=parseImportSession(payload,"Bike intervals\n5 x 4 min @ 260-280 watts",[],"endurance");const swim=parseImportSession(payload,"Swim\n8 x 100 m @ 1:45/100m, 20 sec rest",[],"endurance");const row=parseImportSession(payload,"Row\n6 x 500 m @ 1:55/500m",[],"endurance");
  if(bike.draft.kind!=="endurance"||swim.draft.kind!=="endurance"||row.draft.kind!=="endurance")return;
  assert.equal(bike.draft.template.activityType,"bike");assert.equal(bike.draft.template.blocks.find(block=>block.targetMetric==="power")?.targetMinValue,260);assert.equal(swim.draft.template.activityType,"swim");assert.equal(swim.draft.template.blocks.find(block=>block.targetMetric==="pace")?.targetUnit,"s/100m");assert.equal(row.draft.template.activityType,"row");assert.equal(row.draft.template.blocks.find(block=>block.targetMetric==="pace")?.targetUnit,"s/500m");
});

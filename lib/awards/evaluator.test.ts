import assert from "node:assert/strict";
import test from "node:test";
import {evaluateAwards} from "./evaluator.ts";
import type {AwardEvaluationInput,AwardSessionFact} from "./types.ts";

const session=(id:string,date:string,modality:"strength"|"endurance"="strength",activityType:AwardSessionFact["activityType"]="strength",extra:Partial<AwardSessionFact>={}):AwardSessionFact=>({id,date,modality,activityType,durationSeconds:3600,...extra});
const input=(overrides:Partial<AwardEvaluationInput>={}):AwardEvaluationInput=>({today:"2026-09-18",timezone:"Australia/Melbourne",weekStartsOn:1,weeklySessionGoal:2,sessions:[],volume:[],templates:[],usageDays:["2026-09-18"],planOccurrences:[],stored:[],...overrides});

test("retrospectively awards every reached session threshold without duplicates",()=>{
  const sessions=Array.from({length:73},(_,index)=>session(String(index),`2026-${String(1+Math.floor(index/28)).padStart(2,"0")}-${String(1+(index%28)).padStart(2,"0")}`));
  const result=evaluateAwards(input({sessions}));
  assert.equal(result.awards.find(item=>item.definition.id==="sessions_50")?.earned,true);
  assert.equal(result.awards.find(item=>item.definition.id==="sessions_100")?.earned,false);
  const second=evaluateAwards(input({sessions,stored:result.newlyEarned}));assert.equal(second.newlyEarned.length,0);
});

test("uses the configured week boundary for active, goal and hybrid weeks",()=>{
  const sessions=[session("s1","2026-09-06"),session("e1","2026-09-06","endurance","run"),session("s2","2026-09-13"),session("e2","2026-09-13","endurance","bike")];
  const sunday=evaluateAwards(input({today:"2026-09-13",weekStartsOn:0,sessions}));
  assert.equal(sunday.streaks.activeWeeks.current,2);assert.equal(sunday.streaks.weeklyGoal.current,2);assert.equal(sunday.metrics.hybrid_weeks,2);
});

test("rest days do not break active weeks but do break literal training-day streaks",()=>{
  const sessions=[session("a","2026-09-07"),session("b","2026-09-09"),session("c","2026-09-15")];
  const result=evaluateAwards(input({sessions}));assert.equal(result.streaks.activeWeeks.current,2);assert.equal(result.streaks.trainingDays.longest,1);
});

test("counts only fully completed closed planned weeks",()=>{
  const plans=[{key:"a",date:"2026-09-07",modality:"strength" as const,status:"completed" as const},{key:"b",date:"2026-09-08",modality:"endurance" as const,status:"completed" as const},{key:"c",date:"2026-08-31",modality:"strength" as const,status:"skipped" as const}];
  const result=evaluateAwards(input({planOccurrences:plans}));assert.equal(result.streaks.plannedWeeks.longest,1);assert.equal(result.metrics.first_full_planned_week,1);
});

test("calculates distance, time, strength volume, double days and secrets",()=>{
  const sessions=[session("r1","2026-09-18","endurance","run",{distanceMetres:26000,startedLocalTime:"05:10"}),session("r2","2026-09-18","endurance","run",{distanceMetres:25000}),session("b","2026-09-17","endurance","bike",{distanceMetres:110000})];
  const result=evaluateAwards(input({sessions,volume:[{date:"2026-09-17",kilograms:12000}]}));
  assert.equal(result.awards.find(item=>item.definition.id==="run_km_50")?.earned,true);assert.equal(result.awards.find(item=>item.definition.id==="bike_km_100")?.earned,true);assert.equal(result.awards.find(item=>item.definition.id==="volume_kg_10000")?.earned,true);assert.equal(result.metrics.double_days,1);assert.equal(result.awards.find(item=>item.definition.id==="secret_before_dawn")?.earned,true);
});

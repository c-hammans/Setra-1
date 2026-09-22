import test from "node:test";
import assert from "node:assert/strict";
import {applyPreviousSetValues} from "./workout-updates.ts";
import type {Workout} from "./types.ts";

const workout:Workout={id:"w",name:"Test",date:"2026-09-21",startedAt:"09:00",duration:0,note:"keep",exercises:[
  {exerciseId:"bench",note:"unchanged",loadMode:"kg",sets:[{weight:"20",reps:"2",rpe:"7",done:true},{weight:"30",reps:"3",rpe:"",done:false}]},
  {exerciseId:"row",note:"other",loadMode:"band",sets:[{weight:"red",reps:"12",rpe:"",done:false}]},
]};

test("copies previous weight and reps atomically without changing unrelated data",()=>{
  const result=applyPreviousSetValues(workout,0,0,{weight:"60",reps:"5"});
  assert.deepEqual(result.exercises[0].sets[0],{weight:"60",reps:"5",rpe:"7",done:false});
  assert.deepEqual(result.exercises[0].sets[1],workout.exercises[0].sets[1]);
  assert.deepEqual(result.exercises[1],workout.exercises[1]);
  assert.equal(result.note,"keep");
});

test("fills a blank numeric load and leaves load-mode interpretation to the matching exercise",()=>{
  const blank={...workout,exercises:[{...workout.exercises[0],sets:[{weight:"",reps:"",rpe:"",done:false}]}]};
  assert.deepEqual(applyPreviousSetValues(blank,0,0,{weight:"60",reps:"5"}).exercises[0].sets[0],{weight:"60",reps:"5",rpe:"",done:false});
});

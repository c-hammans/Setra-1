import test from "node:test";
import assert from "node:assert/strict";
import type {EnduranceSession,Workout} from "../setra/types.ts";
import {enduranceWorkoutShareData,strengthPBShareData,strengthWorkoutShareData} from "./share-data.ts";

test("strength session share data separates completed sets and reps",()=>{
  const workout:Workout={id:"workout-1",name:"Wednesday",date:"2026-11-11",startedAt:"09:00",endedAt:"10:08",duration:0,note:"",exercises:[{exerciseId:"squat",note:"",sets:[{weight:"40",reps:"5",rpe:"8",done:true},{weight:"40",reps:"5",rpe:"8",done:true},{weight:"40",reps:"8",rpe:"8",done:false}]},{exerciseId:"row",note:"",sets:[{weight:"30",reps:"8",rpe:"8",done:true},{weight:"",reps:"",rpe:"",done:false}]}]};
  const data=strengthWorkoutShareData(workout);
  assert.deepEqual(data.metrics,[{label:"Sets",value:"3"},{label:"Reps",value:"18"},{label:"Duration",value:"1h 8m"},{label:"Volume",value:"640 kg"}]);
  assert.equal(data.result,"3 sets");
  assert.equal(data.result.includes("/"),false);
  assert.equal(data.label,"Strength");
  assert.equal(/partial|complete/i.test(data.label),false);
});

test("strength PB share data omits the previous result",()=>{
  const data=strengthPBShareData({exerciseId:"zercher",name:"Zercher Squat",weight:40,reps:"5",previousWeight:35});
  assert.equal(data.result,"40 kg");
  assert.equal(data.secondary,"× 5");
  assert.equal(data.improvement,"↑ 5 kg");
  assert.equal(data.previous,undefined);
});

test("endurance share data keeps sport-specific metrics",()=>{
  const session:EnduranceSession={id:"run-1",activityType:"run",status:"completed",title:"Tempo Run",date:"2026-11-11",durationMinutes:48,distanceKm:10.2,averagePaceSecondsPerKm:285,elevationGainMetres:62,notes:"",blocks:[]};
  const data=enduranceWorkoutShareData(session);
  assert.equal(data.result,"10.2 km");
  assert.equal(data.label,"Run");
  assert.deepEqual(data.metrics,[{label:"Time",value:"48:00"},{label:"Avg pace",value:"4:45 /km"},{label:"Elevation",value:"62 m"}]);
});

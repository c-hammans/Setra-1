import assert from "node:assert/strict";
import test from "node:test";
import type {EnduranceSession,Exercise,Workout} from "../setra/types.ts";
import {buildTrainingAnalytics} from "./training-analytics.ts";

const exercises:Exercise[]=[{id:"squat",name:"Back Squat",group:"Quads",equipment:"Barbell"},{id:"row",name:"Row",group:"Back",equipment:"Barbell"}];
const workout=(id:string,date:string,weight:string,reps:string,duration=60):Workout=>({id,name:"Strength",date,startedAt:"07:00",duration,note:"",exercises:[{exerciseId:"squat",note:"",loadMode:"kg",sets:[{weight,reps,rpe:"",done:true},{weight,reps,rpe:"",done:true}]}]});
const endurance=(id:string,date:string,activityType:EnduranceSession["activityType"],values:Partial<EnduranceSession>):EnduranceSession=>({id,date,activityType,status:"completed",title:"Endurance",notes:"",blocks:[],...values});
const build=(strength:Workout[],enduranceRows:EnduranceSession[],range:"4w"|"12w"|"6m"|"1y"|"all"="4w")=>buildTrainingAnalytics({workouts:strength,enduranceSessions:enduranceRows,exercises,range,today:"2026-11-20",weekStartsOn:1});

test("strength analytics use completed numeric sets for volume, frequency, load and reps",()=>{
  const result=build([workout("one","2026-11-03","100","5"),workout("two","2026-11-17","110","8")],[]);
  assert.equal(result.strengthSessions,2);
  assert.equal(result.strengthSets,4);
  assert.equal(result.strengthVolumeKg,2760);
  assert.equal(result.exerciseFrequency[0].sessions,2);
  assert.equal(result.loadProgression[0].loadChangeKg,10);
  assert.deepEqual(result.repRanges.map(item=>item.count),[2,2,0,0,0]);
  assert.equal(result.buckets.length,5);
});

test("endurance analytics preserve missing metrics instead of inventing zero trends",()=>{
  const result=build([], [endurance("run","2026-11-10","run",{distanceKm:10,durationMinutes:50,averagePaceSecondsPerKm:300,elevationGainMetres:120}),endurance("bike","2026-11-18","bike",{durationMinutes:90})]);
  assert.equal(result.enduranceSessions,2);
  assert.equal(result.enduranceDistanceKm,10);
  assert.equal(result.durationMinutes,140);
  assert.equal(result.heartRateAverage,undefined);
  assert.equal(result.activities.find(item=>item.activityType==="bike")?.latestPerformance,undefined);
  assert.equal(result.elevationMetres,120);
});

test("hybrid totals combine sessions and known duration without mixing sport metrics",()=>{
  const result=build([workout("strength","2026-11-17","80","10",45)],[endurance("run","2026-11-18","run",{distanceKm:5,durationMinutes:30,averageHeartRate:150})]);
  assert.equal(result.totalSessions,2);
  assert.equal(result.strengthSessions,1);
  assert.equal(result.enduranceSessions,1);
  assert.equal(result.durationMinutes,75);
  assert.equal(result.strengthVolumeKg,1600);
  assert.equal(result.enduranceDistanceKm,5);
  assert.equal(result.heartRateAverage,150);
});

test("finite ranges compare against the immediately preceding equal period",()=>{
  const result=build([workout("previous","2026-10-10","50","5"),workout("current","2026-11-10","100","5")],[]);
  assert.equal(result.comparison.sessions.current,1);
  assert.equal(result.comparison.sessions.previous,1);
  assert.equal(result.comparison.volume.changePercent,100);
});

test("all time includes sparse long history and selects a practical bucket",()=>{
  const result=build([workout("old","2023-01-10","50","5"),workout("new","2026-11-10","100","5")],[],"all");
  assert.equal(result.totalSessions,2);
  assert.equal(result.period.bucket,"year");
  assert.equal(result.buckets.length,4);
  assert.equal(result.comparison.sessions.previous,0);
});

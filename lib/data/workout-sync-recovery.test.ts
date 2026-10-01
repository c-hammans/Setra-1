import assert from "node:assert/strict";
import test from "node:test";
import type {Workout} from "../setra/types.ts";
import type {PendingDiaryChange} from "./local-diary.ts";
import {completedCloudContainsDraft,completedCloudSupersedesDraft,recoveryCopyClientId} from "./workout-sync-recovery.ts";

const workout=(done:boolean,weight="60"):Workout=>({id:"workout-a",templateId:"template-a",name:"Session",date:"2026-09-21",startedAt:"08:00",duration:40,note:"",updatedAt:"2026-09-21T09:00:00Z",exercises:[{exerciseId:"squat",loadMode:"kg",note:"",sets:[{weight,reps:"5",rpe:"8",done}]}]});
const pending=(value:Workout):PendingDiaryChange=>({key:"workout:workout-a",operationId:"device-op",revision:1,expectedVersion:1,protocolVersion:2,updatedAt:"2026-09-21T09:00:00Z",kind:"save_workout",payload:{workout:value,status:"in_progress"}});

test("a newer completed cloud workout retires its contained device draft",()=>{
  const cloud={...workout(true),completedAt:"2026-09-21T09:30:00Z",updatedAt:"2026-09-21T09:30:00Z"};
  assert.equal(completedCloudSupersedesDraft(pending(workout(false)),cloud,2),true);
  assert.equal(completedCloudContainsDraft(workout(false),cloud),true);
});

test("divergent local edits remain a real conflict",()=>{
  const cloud={...workout(true,"70"),completedAt:"2026-09-21T09:30:00Z",updatedAt:"2026-09-21T09:30:00Z"};
  assert.equal(completedCloudSupersedesDraft(pending(workout(false,"65")),cloud,2),false);
});

test("a cloud version that is not newer cannot retire the draft",()=>{
  const cloud={...workout(true),completedAt:"2026-09-21T09:30:00Z"};
  assert.equal(completedCloudSupersedesDraft(pending(workout(false)),cloud,1),false);
});

test("recovery copy identity is stable across repeated actions",()=>{
  assert.equal(recoveryCopyClientId("workout-a","device-op"),recoveryCopyClientId("workout-a","device-op"));
});

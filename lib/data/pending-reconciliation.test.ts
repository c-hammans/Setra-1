import test from "node:test";
import assert from "node:assert/strict";
import {overlayPendingStrength} from "./pending-reconciliation.ts";
import type {AppData,Workout} from "../setra/types.ts";
import type {PendingDiaryChange} from "./local-diary.ts";

const base:AppData={exercises:[],templates:[],scheduled:[],workouts:[]};
const workout=(name:string):Workout=>({id:"w",name,date:"2026-09-19",startedAt:"09:00",duration:10,note:"",exercises:[]});
const change=(operationId:string,revision:number,name:string):PendingDiaryChange=>({key:"workout:w",operationId,revision,expectedVersion:0,updatedAt:new Date(revision).toISOString(),kind:"save_workout",payload:{workout:workout(name),status:"completed"}});

test("cloud refresh retains the newest unacknowledged local revision",()=>{
  const result=overlayPendingStrength({...base,workouts:[workout("Cloud")]},[change("a",1,"Local A"),change("b",2,"Local B")]);
  assert.equal(result.workouts[0].name,"Local B");
});

test("a pending delete cannot be resurrected by cloud refresh",()=>{
  const deleted:PendingDiaryChange={key:"workout:w",operationId:"d",revision:3,expectedVersion:0,updatedAt:new Date().toISOString(),kind:"delete_workout",payload:{clientId:"w"}};
  assert.equal(overlayPendingStrength({...base,workouts:[workout("Cloud")]},[deleted]).workouts.length,0);
});

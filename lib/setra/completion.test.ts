import test from "node:test";
import assert from "node:assert/strict";
import {countsAsTrainingSession,satisfiesPlannedSession,strengthCompletion} from "./completion.ts";
import type {Workout} from "./types.ts";

const workout=(done:number,total=3):Workout=>({id:"w",name:"Test",date:"2026-09-19",startedAt:"09:00",duration:20,note:"",exercises:[{exerciseId:"squat",note:"",sets:Array.from({length:total},(_,index)=>({reps:"5",weight:"50",rpe:"",done:index<done}))}]});
test("one of thirteen planned sets is a partial but eligible training session",()=>{const value=workout(1,13);assert.equal(strengthCompletion(value).status,"partial");assert.equal(countsAsTrainingSession(value),true);assert.equal(satisfiesPlannedSession(value),false)});
test("all prescribed work is complete",()=>{const value=workout(3);assert.equal(strengthCompletion(value).status,"complete");assert.equal(satisfiesPlannedSession(value),true)});
test("zero completed sets is not an eligible session",()=>assert.equal(countsAsTrainingSession(workout(0)),false));

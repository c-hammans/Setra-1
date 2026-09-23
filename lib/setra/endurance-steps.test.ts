import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {calculateStructuredTotals} from "./endurance-steps.ts";
import type {TrainingSessionBlock} from "./types.ts";

describe("structured endurance totals",()=>{
  it("marks a mixed distance and timed workout as partial rather than complete",()=>{const blocks:TrainingSessionBlock[]=[{id:"work",type:"interval",title:"Work",instructions:"",completionType:"distance",distanceMetres:1000},{id:"recovery",type:"recovery",title:"Recovery",instructions:"",completionType:"time",durationSeconds:120}];const totals=calculateStructuredTotals(blocks);assert.equal(totals.distanceMetres,1000);assert.equal(totals.durationSeconds,120);assert.equal(totals.distanceCoverage,"partial");assert.equal(totals.durationCoverage,"partial")});
  it("supports nested repeat multipliers",()=>{const blocks:TrainingSessionBlock[]=[{id:"outer",type:"repeat_group",title:"Outer",instructions:"",repetitions:3},{id:"inner",parentId:"outer",type:"repeat_group",title:"Inner",instructions:"",repetitions:4},{id:"work",parentId:"inner",type:"interval",title:"Work",instructions:"",completionType:"distance",distanceMetres:400}];assert.equal(calculateStructuredTotals(blocks).distanceMetres,4800)});
  it("keeps an entirely open workout unknown",()=>{const totals=calculateStructuredTotals([{id:"open",type:"custom",title:"Open",instructions:"",completionType:"open"}]);assert.equal(totals.distanceCoverage,"unknown");assert.equal(totals.durationCoverage,"unknown")});
});

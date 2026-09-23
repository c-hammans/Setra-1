import assert from "node:assert/strict";import {describe,it} from "node:test";import {newBlankWorkout,newTemplateWorkout} from "./new-workout.ts";
const template={id:"lower",name:"Lower",focus:"Legs",color:"#fff",icon:"",exercises:[]};
describe("new strength workouts",()=>{
  it("preserves the selected historical date for template and blank workouts",()=>{assert.equal(newTemplateWorkout(template,"2026-09-01","10:00",[]).date,"2026-09-01");assert.equal(newBlankWorkout("2026-09-02","10:00").date,"2026-09-02")});
  it("uses collision-resistant identities rather than record counts",()=>{const ids=new Set(Array.from({length:250},()=>newBlankWorkout("2026-09-02","10:00").id));assert.equal(ids.size,250)});
  it("preserves a supplied identity across reconstruction and retry",()=>{const id="workout-stable-retry";assert.equal(newTemplateWorkout(template,"2026-09-01","10:00",[],id).id,id);assert.equal(newBlankWorkout("2026-09-02","10:00",id).id,id)});
});

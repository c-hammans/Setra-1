import assert from "node:assert/strict";import {describe,it} from "node:test";import {newBlankWorkout,newTemplateWorkout} from "./new-workout.ts";
const template={id:"lower",name:"Lower",focus:"Legs",color:"#fff",icon:"",exercises:[]};
describe("backdated strength logging",()=>{it("preserves the selected historical date for template and blank workouts",()=>{assert.equal(newTemplateWorkout(template,"2026-09-01",1,"10:00",[]).date,"2026-09-01");assert.equal(newBlankWorkout("2026-09-02",2,"10:00").date,"2026-09-02")})});

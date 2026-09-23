import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {recoveryComparison} from "./recovery-comparison.ts";
import type {PendingDiaryChange} from "./local-diary.ts";

describe("recovery comparison",()=>{
  it("shows useful field differences and missing cloud records",()=>{
    const change={key:"workout:w",operationId:"op",revision:1,expectedVersion:0,protocolVersion:2,updatedAt:"2026-01-01",kind:"save_workout",payload:{status:"completed",workout:{id:"w",name:"Run",date:"2026-01-01",startedAt:"08:00",duration:30,note:"Good",exercises:[]}}} as PendingDiaryChange;
    const fields=recoveryComparison(change,null);
    assert.equal(fields.find(item=>item.label==="Date")?.cloud,"No cloud record");
    assert.equal(fields.find(item=>item.label==="Session notes")?.device,"Good");
  });
  it("detects same-shaped workouts with different exercises and loads",()=>{
    const base={id:"w",name:"Session",date:"2026-01-01",startedAt:"08:00",duration:30,note:"",exercises:[{exerciseId:"squat",note:"",loadMode:"kg" as const,sets:[{weight:"60",reps:"5",rpe:"8",done:true}]}]};
    const change={key:"workout:w",operationId:"op",revision:1,expectedVersion:0,protocolVersion:2,updatedAt:"2026-01-01",kind:"save_workout",payload:{status:"completed",workout:base}} as PendingDiaryChange;
    const cloud={...base,exercises:[{exerciseId:"bench-press",note:"",loadMode:"kg" as const,sets:[{weight:"40",reps:"5",rpe:"8",done:true}]}]};
    const field=recoveryComparison(change,cloud).find(item=>item.label==="Exercise detail");
    assert.equal(field?.different,true);assert.match(field?.device||"",/squat/);assert.match(field?.cloud||"",/bench-press/);
  });
  it("detects reordered and nested endurance blocks",()=>{
    const session={id:"e",title:"Intervals",date:"2026-01-01",status:"planned" as const,activityType:"run" as const,notes:"",blocks:[{id:"g",type:"repeat_group" as const,title:"Set",instructions:"",repetitions:3},{id:"w",parentId:"g",type:"interval" as const,title:"Work",instructions:"",completionType:"distance" as const,distanceMetres:400,targetMetric:"pace" as const,targetMinValue:240,targetUnit:"sec/km"},{id:"r",parentId:"g",type:"recovery" as const,title:"Recover",instructions:"",completionType:"time" as const,durationSeconds:60}]};
    const change={key:"endurance-session:e",operationId:"op",revision:1,expectedVersion:0,protocolVersion:2,updatedAt:"2026-01-01",kind:"save_endurance_session",payload:{session}} as PendingDiaryChange;
    const cloud={...session,blocks:[session.blocks[0],session.blocks[2],session.blocks[1]]};
    assert.equal(recoveryComparison(change,cloud).find(item=>item.label==="Structure")?.different,true);
  });
});

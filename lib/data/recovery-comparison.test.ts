import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {recoveryComparison} from "./recovery-comparison.ts";
import type {PendingDiaryChange} from "./local-diary.ts";

describe("recovery comparison",()=>{
  it("shows useful field differences and missing cloud records",()=>{
    const change={key:"workout:w",operationId:"op",revision:1,expectedVersion:0,protocolVersion:2,updatedAt:"2026-01-01",kind:"save_workout",payload:{status:"completed",workout:{id:"w",name:"Run",date:"2026-01-01",startedAt:"08:00",duration:30,note:"Good",exercises:[]}}} as PendingDiaryChange;
    const fields=recoveryComparison(change,null);
    assert.equal(fields.find(item=>item.label==="Date")?.cloud,"No cloud record");
    assert.equal(fields.find(item=>item.label==="Notes")?.device,"Good");
  });
});

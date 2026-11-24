import test from "node:test";
import assert from "node:assert/strict";
import {coachGroupCanAssign,coachGroupRecipientIds} from "./groups.ts";
import type {CoachGroup} from "./types.ts";

const group=(overrides:Partial<CoachGroup>={}):CoachGroup=>({id:"group-one",name:"Tuesday Run Squad",description:"",createdAt:"2026-11-23",updatedAt:"2026-11-23",upcoming:[],members:[{relationshipId:"relationship-one",clientUserId:"client-one",displayName:"Athlete One",username:"athlete-one",assignTraining:true}],...overrides});

test("group assignment uses current independent relationship recipients",()=>{
  const subject=group({members:[
    {relationshipId:"relationship-one",clientUserId:"client-one",displayName:"One",username:"one",assignTraining:true},
    {relationshipId:"relationship-two",clientUserId:"client-two",displayName:"Two",username:"two",assignTraining:true},
  ]});
  assert.deepEqual(coachGroupRecipientIds(subject),["relationship-one","relationship-two"]);
  assert.equal(coachGroupCanAssign(subject),true);
});

test("empty, archived or permission-incomplete groups cannot be assigned",()=>{
  assert.equal(coachGroupCanAssign(group({members:[]})),false);
  assert.equal(coachGroupCanAssign(group({archivedAt:"2026-11-23T00:00:00Z"})),false);
  assert.equal(coachGroupCanAssign(group({members:[{relationshipId:"relationship-one",clientUserId:"client-one",displayName:"One",username:"one",assignTraining:false}]})),false);
});

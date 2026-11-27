import assert from "node:assert/strict";
import test from "node:test";
import type {AccessState} from "./access.ts";
import {plusFeatures,plusFeatureStatus,plusOfferedPlans,progressLink} from "./plus.ts";

const access=(plan:AccessState["plan"]):AccessState=>({plan,roles:["athlete"]});
test("Plus lists the catalogue and distinguishes usable, locked and upcoming features",()=>{
  assert.ok(plusFeatures("premium").includes("advanced_analytics"));
  assert.ok(plusFeatures("adaptive").includes("ask_setra_training"));
  assert.equal(plusFeatureStatus(access("free"),"advanced_analytics").state,"locked");
  assert.equal(plusFeatureStatus(access("premium"),"advanced_analytics").state,"open");
  assert.equal(plusFeatureStatus(access("premium"),"ask_setra_training").state,"locked");
  assert.equal(plusFeatureStatus(access("adaptive"),"ask_setra_training").state,"open");
  assert.equal(plusFeatureStatus(access("adaptive"),"ai_training_insights").state,"upcoming");
  assert.deepEqual(plusOfferedPlans("advanced_analytics"),["premium","adaptive"]);
  assert.deepEqual(plusOfferedPlans("ask_setra_training"),["adaptive"]);
});
test("available features open History → Progress and old Weekly Review links still work",()=>{
  for(const key of [...plusFeatures("premium"),...plusFeatures("adaptive")]){
    const state=plusFeatureStatus(access("adaptive"),key);
    if(state.state!=="open")continue;
    const url=new URL(state.href,"https://setra.test");
    assert.deepEqual(progressLink(url.search,url.hash),{requested:true,anchor:url.hash.slice(1)});
  }
  assert.deepEqual(progressLink("?tab=pbs","#adaptive-weekly-review"),{requested:true,anchor:"adaptive-weekly-review"});
  assert.deepEqual(progressLink("?tab=pbs",""),{requested:false,anchor:null});
});

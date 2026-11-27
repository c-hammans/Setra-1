import assert from "node:assert/strict";
import test from "node:test";
import {dateBetween,selectPlanOptions,validatePlanChanges,withStrengthPrescription,type PlanSnapshot} from "./plan-adjustments.ts";
import {buildPlanOptions} from "./plan-options.ts";
import {hasFeature,type IndividualPlan} from "../premium/access.ts";
import {planChangeFeatures} from "./plan-adjustments.ts";

const day="2026-11-27";
const lift:PlanSnapshot={id:"lift",modality:"strength",title:"Lower Body",date:"2026-11-30",state:"planned",stamp:"original",blocked:false,
  fields:[{key:"exercise:0:load",label:"Squat · load",value:80,unit:"kg"},{key:"exercise:0:sets",label:"Squat · sets",value:4}]};
const run:PlanSnapshot={id:"run",modality:"endurance",title:"Intervals",date:"2026-12-02",state:"planned",stamp:"original",blocked:false,
  activityType:"run",fields:[{key:"block:0:repetitions",label:"Repeat group · repeats",value:5}]};

test("strength progression is bounded and updates only the occurrence prescription",()=>{
  const option=buildPlanOptions([lift],"progress",day,"squat")[0];
  assert.equal(option.proposed,82.5);
  assert.equal(validatePlanChanges([{optionId:option.id,value:81.25}],[option],"2026-11-28","2026-12-25")[0].value,81.25);
  assert.throws(()=>validatePlanChanges([{optionId:option.id,value:120}],[option],"2026-11-28","2026-12-25"));
  const template={id:"source",name:"Lower",focus:"",exercises:[{exerciseId:"squat",sets:4,reps:"6",plannedLoad:{mode:"kg" as const,value:"80"}}]};
  assert.equal(withStrengthPrescription(template,{"exercise:0:load":82.5}).exercises[0].plannedLoad?.value,"82.5");
  assert.equal(template.exercises[0].plannedLoad.value,"80");
  assert.deepEqual(withStrengthPrescription({...template,coachAssignmentId:"coach"}, {"exercise:0:load":82.5}).exercises,template.exercises);
});

test("a model may choose one bounded edit per session, never invent options",()=>{
  const options=[...buildPlanOptions([lift],"progress",day,"squat"),...buildPlanOptions([run],"reduce",day)];
  const repeat=options.find(item=>item.session.id==="run")!;
  assert.equal(repeat.proposed,4);
  assert.equal(selectPlanOptions({optionIds:[options[0].id,repeat.id]},options).length,2);
  assert.throws(()=>selectPlanOptions({optionIds:["unknown"]},options));
  assert.throws(()=>selectPlanOptions({optionIds:options.filter(item=>item.session.id==="lift").map(item=>item.id)},options));
  assert.deepEqual(selectPlanOptions({optionIds:[]},options),[]);
});

test("exclude locked sessions and reject invalid, unchanged or out-of-window dates",()=>{
  const options=buildPlanOptions([lift,{...run,blocked:true},{...lift,id:"today",date:day},{...run,id:"completed",state:"completed"}],"schedule",day);
  assert.deepEqual(options.map(item=>item.session.id),["lift"]);
  assert.equal(dateBetween("2026-11-31","2026-11-28","2026-12-25"),false);
  for(const value of ["2026-11-27","2026-11-30","2027-01-01"])assert.throws(()=>validatePlanChanges([{optionId:options[0].id,value}],options,"2026-11-28","2026-12-25"));
});

test("both plan-change entitlements are exclusive to Adaptive",()=>{
  for(const plan of ["free","premium","adaptive"] as IndividualPlan[])
    assert.equal(planChangeFeatures.every(feature=>hasFeature({plan,roles:["athlete"]},feature)),plan==="adaptive");
});

import assert from "node:assert/strict";
import test from "node:test";
import {buildAskSetraContext} from "./ask-setra-context.ts";
import {parseAskSetraAnswer} from "./ask-setra-schema.ts";
import {askSetraContextSections,selectAskSetraIntents} from "./ask-setra-selector.ts";

const source=(question:string)=>({question,today:"2026-11-24",timezone:"Australia/Melbourne",weekStartsOn:1 as const,occurrences:[{planned_date:"2026-11-23",status:"completed",modality:"strength"}],sessions:[{id:"strength-db",client_id:"strength-1",modality:"strength",activity_type:"strength",status:"completed",title:"Lower Body",session_date:"2026-11-23",duration_seconds:3600,completed_rpe:8},{id:"run-db",client_id:"run-1",modality:"endurance",activity_type:"run",status:"completed",title:"5K",session_date:"2026-11-22",duration_seconds:1260,distance_metres:5000,average_pace_seconds_per_km:252},{id:"planned",client_id:"planned-1",modality:"endurance",activity_type:"run",status:"planned",title:"Easy Run",session_date:"2026-11-27"}],workouts:[{id:"w1",workout_date:"2026-10-10",workout_exercises:[{load_mode:"kg",skipped:false,exercises:{name:"Back Squat"},workout_sets:[{completed:true,weight:100,reps:"5"}]}]},{id:"w2",workout_date:"2026-11-23",workout_exercises:[{load_mode:"kg",skipped:false,exercises:{name:"Back Squat"},workout_sets:[{completed:true,weight:110,reps:"5"}]}]}],checkIns:[{completed_client_id:"strength-1",session_rpe:8,session_feel:"harder",athlete_comment:"Legs felt heavy.",updated_at:"2026-11-23T10:00:00Z"}],goals:[{title:"Back Squat 120 kg",goal_type:"strength",metric_type:"strength_load",target_label:"Back Squat",target_value:120,target_unit:"kg",is_primary:true,status:"active",approval_status:"accepted",current_value:110}],personalBests:[{kind:"strength",label:"Back Squat",result:"110 kg × 5",date:"2026-11-23"},{kind:"endurance",label:"5K",result:"1260 seconds",date:"2026-11-22"}],programs:[],reviews:[{week_start:"2026-11-16",week_end:"2026-11-22",review:{weekAtAGlance:["Two sessions were completed."],worthNoting:["RPE was recorded."]}}],conversation:Array.from({length:8},(_,index)=>({question:`Question ${index}`,answer:{facts:[`Fact ${index}`],interpretation:null,recommendations:[],dataConfidence:{level:"high",summary:"Recorded",gaps:[]},suggestedFollowUps:[],safetyNote:null}}))});

test("question selection includes only relevant detailed training sections",()=>{
  assert.deepEqual(selectAskSetraIntents("Am I progressing on my squat?"),["strength"]);assert.deepEqual(askSetraContextSections(["strength"]),{strength:true,endurance:false,feedback:false,goals:false,reviews:false,upcoming:false});
});

test("strength questions receive exercise progression without endurance detail",()=>{
  const {context}=buildAskSetraContext(source("Am I progressing on my Back Squat?"));assert.equal(context.strengthProgress?.[0].exercise,"Back Squat");assert.equal(context.strengthProgress?.[0].firstMaxLoadKg,100);assert.equal(context.strengthProgress?.[0].latestMaxLoadKg,110);assert.equal(context.enduranceProgress,null);
});

test("endurance and goal questions receive relevant summaries and bounded conversation",()=>{
  const {context}=buildAskSetraContext(source("How am I tracking toward my 5K goal and has my running changed?"));assert.equal(context.enduranceProgress?.[0].distanceKm,5);assert.equal(context.goals?.[0].title,"Back Squat 120 kg");assert.equal(context.conversation.length,6);assert.ok(context.availableLinks.some(link=>link.targetType==="goals"));
  assert.equal(context.personalBests?.[0].label,"5K");
});

test("medical questions are flagged and include feedback without unsupported detail",()=>{
  const {context}=buildAskSetraContext(source("Does this knee pain mean I am overtrained?"));assert.equal(context.selection.medicalConcern,true);assert.equal(context.athleteFeedback?.[0].feel,"harder");assert.equal(context.strengthProgress,null);
});

test("Ask Setra structured answers preserve facts and reject missing facts",()=>{
  const answer={facts:["Two sessions were recorded."],interpretation:"The recorded load increased.",recommendations:["Keep the next step optional."],dataConfidence:{level:"medium",summary:"Some duration data was missing.",gaps:["One session had no duration."]},suggestedFollowUps:["How did strength volume change?"],safetyNote:null};assert.deepEqual(parseAskSetraAnswer(answer),answer);assert.throws(()=>parseAskSetraAnswer({...answer,facts:[]}));
});

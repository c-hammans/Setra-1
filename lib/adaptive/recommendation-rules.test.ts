import assert from "node:assert/strict";
import test from "node:test";
import {buildRecommendationCandidates} from "./recommendation-rules.ts";
import {parseRecommendationDrafts} from "./recommendation-schema.ts";
import type {AskSetraContext} from "./ask-setra-types.ts";
import type {RecommendationSource} from "./recommendation-types.ts";
import type {WeeklyReviewContext,WeeklyReviewMetricPeriod} from "./weekly-review-types.ts";

const period=(overrides:Partial<WeeklyReviewMetricPeriod>={}):WeeklyReviewMetricPeriod=>({weekStart:"2026-11-16",planned:4,completed:4,skipped:0,rescheduled:0,adherencePercent:100,totalSessions:4,durationMinutes:240,strengthSessions:2,enduranceSessions:2,strengthSets:16,strengthVolumeKg:8000,enduranceDistanceKm:20,activityMix:{run:2},sportMetrics:{},...overrides});
const weekly=(overrides:Partial<WeeklyReviewContext>={}):WeeklyReviewContext=>({schemaVersion:"weekly-review-context-v1",week:{start:"2026-11-16",end:"2026-11-22",timezone:"Australia/Melbourne",weekStartsOn:1},current:period(),previous:period({weekStart:"2026-11-09"}),priorFourWeekAverage:{...period({weekStart:""}),enduranceDistanceKm:15,totalSessions:4},checkIns:[],goals:[],activeProgram:null,personalBests:[],dataGaps:[],...overrides});
const ask=(overrides:Partial<AskSetraContext>={}):AskSetraContext=>({schemaVersion:"ask-setra-context-v1",asOf:"2026-11-27",timezone:"Australia/Melbourne",selection:{intents:["recommendation"],medicalConcern:false,lookbackDays:84},weekly:weekly(),upcomingSessions:[],recentSessions:[],strengthProgress:[],enduranceProgress:[],athleteFeedback:[],goals:[],personalBests:[],activeProgram:null,recentWeeklyReviews:[],conversation:[],availableLinks:[],...overrides});
const source=(overrides:Partial<RecommendationSource>={}):RecommendationSource=>({today:"2026-11-27",weekly:weekly(),askContext:ask(),goalRows:[],...overrides});

test("creates a running-volume recommendation only from a meaningful completed-week increase",()=>{
  const result=buildRecommendationCandidates(source({weekly:weekly({current:period({enduranceDistanceKm:31,enduranceSessions:3,activityMix:{run:3}}),priorFourWeekAverage:{...period({weekStart:""}),enduranceDistanceKm:24,totalSessions:4}})}));
  assert.equal(result.candidates[0]?.type,"maintain");assert.match(result.candidates[0]?.evidence[1]||"",/29%/);
});

test("repeated hard check-ins create conservative recovery and scheduling candidates",()=>{
  const feedback=["2026-11-25","2026-11-22","2026-11-18"].map(date=>({date,rpe:9,feel:"harder",comment:null}));
  const result=buildRecommendationCandidates(source({askContext:ask({athleteFeedback:feedback,upcomingSessions:[{id:"next-1",date:"2026-11-28",title:"Intervals",modality:"endurance",activityType:"run",status:"planned"}]})}));
  assert.ok(result.candidates.some(item=>item.type==="recovery_consideration"));assert.ok(result.candidates.some(item=>item.type==="schedule"));assert.ok(!result.candidates.some(item=>item.type==="progress"));
});

test("repeated completed strength work can support a cautious progression candidate",()=>{
  const result=buildRecommendationCandidates(source({askContext:ask({strengthProgress:[{exercise:"Back Squat",sessions:4,completedSets:12,volumeKg:5000,firstMaxLoadKg:100,latestMaxLoadKg:105,firstDate:"2026-10-01",latestDate:"2026-11-24"}]})}));
  assert.equal(result.candidates.find(item=>item.type==="progress")?.key,"strength-progress-back-squat");
});

test("an approaching primary goal is considered only when recent consistency is meaningfully lower",()=>{
  const goals=[{title:"Sub-20 5K",type:"running",targetDate:"2026-12-20",primary:true,currentValue:1240,targetValue:1199,unit:"seconds"}];
  const result=buildRecommendationCandidates(source({weekly:weekly({current:period({totalSessions:0}),priorFourWeekAverage:{...period({weekStart:""}),totalSessions:3},goals}),goalRows:[{goal_id:"11111111-1111-4111-8111-111111111111",title:"Sub-20 5K"}]}));
  const candidate=result.candidates.find(item=>item.type==="goal");assert.equal(candidate?.relatedGoalId,"11111111-1111-4111-8111-111111111111");
});

test("insufficient evidence produces no candidate and material evidence changes the source hash",()=>{
  const empty=buildRecommendationCandidates(source({weekly:weekly({current:period({enduranceSessions:0,enduranceDistanceKm:0,activityMix:{}}),priorFourWeekAverage:null})}));assert.equal(empty.candidates.length,0);
  const changed=buildRecommendationCandidates(source({askContext:ask({strengthProgress:[{exercise:"Deadlift",sessions:3,completedSets:9,volumeKg:4000,firstMaxLoadKg:100,latestMaxLoadKg:110,firstDate:"2026-10-01",latestDate:"2026-11-24"}]})}));assert.notEqual(empty.sourceHash,changed.sourceHash);
});

test("AI output is restricted to the deterministic candidate keys and types",()=>{
  const candidate=buildRecommendationCandidates(source({askContext:ask({strengthProgress:[{exercise:"Back Squat",sessions:3,completedSets:9,volumeKg:4000,firstMaxLoadKg:100,latestMaxLoadKg:105,firstDate:"2026-10-01",latestDate:"2026-11-24"}]})})).candidates;
  const valid={recommendations:[{candidateKey:candidate[0].key,type:candidate[0].type,title:"Consider a small progression",recommendation:"Based on three recorded sessions, consider a small progression if repetitions and technique remain consistent.",confidence:candidate[0].confidence}]};assert.equal(parseRecommendationDrafts(valid,candidate).length,1);
  assert.throws(()=>parseRecommendationDrafts({recommendations:[{...valid.recommendations[0],candidateKey:"invented"}]},candidate));
});

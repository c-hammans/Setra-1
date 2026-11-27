import {createHash} from "node:crypto";
import type {RecommendationCandidate,RecommendationSource} from "./recommendation-types.ts";

const round=(value:number,digits=0)=>Number(value.toFixed(digits));
const dayDifference=(from:string,to:string)=>Math.round((new Date(`${to}T12:00:00Z`).getTime()-new Date(`${from}T12:00:00Z`).getTime())/86400000);
const canonical=(value:unknown):string=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`:JSON.stringify(value);

function goalId(source:RecommendationSource,title:string){const row=source.goalRows.find(item=>String(item.title)===title);const id=row?.goal_id??row?.id;return id?String(id):null}

export function buildRecommendationCandidates(source:RecommendationSource):{candidates:RecommendationCandidate[];sourceHash:string}{
  const candidates:RecommendationCandidate[]=[];const feedback=source.askContext.athleteFeedback||[];
  const recentFeedback=feedback.filter(item=>dayDifference(item.date,source.today)>=0&&dayDifference(item.date,source.today)<=21);
  const hardSignals=recentFeedback.filter(item=>(item.rpe??0)>=9||item.feel==="harder");
  const highRpeSessions=source.askContext.recentSessions.filter(item=>dayDifference(item.date,source.today)>=0&&dayDifference(item.date,source.today)<=21&&(item.rpe??0)>=9);
  const hardSignalCount=Math.max(hardSignals.length,highRpeSessions.length);
  const current=source.weekly.current,average=source.weekly.priorFourWeekAverage;
  const activityKeys=Object.keys(current.activityMix).filter(key=>current.activityMix[key]>0);
  const runningOnly=current.enduranceSessions>0&&activityKeys.length===1&&activityKeys[0]==="run";
  const distanceChange=average?.enduranceDistanceKm?round((current.enduranceDistanceKm-average.enduranceDistanceKm)/average.enduranceDistanceKm*100):null;

  if(runningOnly&&current.enduranceSessions>=2&&current.enduranceDistanceKm>=10&&distanceChange!=null&&distanceChange>=20){
    const reduce=distanceChange>=35&&hardSignalCount>=2;
    candidates.push({key:reduce?"running-volume-reduce":"running-volume-maintain",type:reduce?"reduce":"maintain",evidence:[`The last completed week included ${current.enduranceDistanceKm} km of running across ${current.enduranceSessions} sessions.`,`That was ${distanceChange}% above the preceding four-week average of ${average!.enduranceDistanceKm} km.`,...(reduce?[`${hardSignalCount} recent sessions recorded RPE 9–10 or harder than expected.`]:[])],direction:reduce?"Suggest avoiding another running-volume increase and considering a modest reduction or easier week.":"Suggest holding running volume near the latest completed week before increasing again.",confidence:reduce?"high":"medium",relatedSessionId:null,relatedGoalId:null});
  }

  if(hardSignalCount>=2){
    candidates.push({key:"repeated-hard-feedback",type:"recovery_consideration",evidence:[`${hardSignalCount} sessions in the last 21 days were recorded at RPE 9–10 or harder than expected.`,"Setra cannot determine fatigue, readiness, injury or illness from check-ins."],direction:"Suggest preserving recovery and avoiding an automatic increase until the next sessions provide more evidence.",confidence:"high",relatedSessionId:null,relatedGoalId:null});
    const next=source.askContext.upcomingSessions[0];if(next&&hardSignalCount>=3)candidates.push({key:`review-upcoming-${next.id}`,type:"schedule",evidence:[`${next.title} is the next recorded planned session on ${next.date}.`,`${hardSignalCount} recent sessions were recorded at RPE 9–10 or harder than expected.`],direction:"Suggest reviewing the upcoming session's load or intensity without changing it automatically.",confidence:"medium",relatedSessionId:next.id,relatedGoalId:null});
  }

  if(!hardSignalCount){
    const progression=(source.askContext.strengthProgress||[]).filter(item=>item.sessions>=3&&item.completedSets>=item.sessions*2&&item.latestMaxLoadKg!=null&&item.firstMaxLoadKg!=null&&item.latestMaxLoadKg>=item.firstMaxLoadKg).sort((a,b)=>b.sessions-a.sessions)[0];
    if(progression)candidates.push({key:`strength-progress-${progression.exercise.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,type:"progress",evidence:[`${progression.exercise} was recorded in ${progression.sessions} completed sessions between ${progression.firstDate} and ${progression.latestDate}.`,`${progression.completedSets} completed sets were recorded, with a latest maximum load of ${progression.latestMaxLoadKg} kg compared with ${progression.firstMaxLoadKg} kg in the earliest session.`,`No RPE 9–10 or harder-than-expected check-in was recorded in the last 21 days.`],direction:`Suggest considering a small progression for ${progression.exercise} if the recorded sets were completed with the intended technique and repetitions.`,confidence:"medium",relatedSessionId:null,relatedGoalId:null});
  }

  const primary=source.weekly.goals.find(goal=>goal.primary&&goal.targetDate);const sessionsAverage=average?.totalSessions??0;
  if(primary&&primary.targetDate&&dayDifference(source.today,primary.targetDate)>=0&&dayDifference(source.today,primary.targetDate)<=56&&sessionsAverage>=1.5&&current.totalSessions<Math.max(1,sessionsAverage*.6)){
    candidates.push({key:`goal-consistency-${primary.title.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`,type:"goal",evidence:[`${primary.title} is the primary active goal with a target date of ${primary.targetDate}.`,`The last completed week contained ${current.totalSessions} session${current.totalSessions===1?"":"s"}, compared with a preceding four-week average of ${round(sessionsAverage,1)}.`],direction:"Suggest reviewing whether the upcoming plan contains enough relevant, realistic work for the active goal.",confidence:"medium",relatedSessionId:null,relatedGoalId:goalId(source,primary.title)});
  }

  const limited=candidates.slice(0,5);return {candidates:limited,sourceHash:createHash("sha256").update(canonical(limited)).digest("hex")};
}

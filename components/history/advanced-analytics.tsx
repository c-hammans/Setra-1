"use client";

import {useMemo,useState} from "react";
import {ActivityIcon} from "@/components/endurance/activity-icon";
import {activityLabel} from "@/components/endurance/endurance-session-sheet";
import {FeatureGate,UpgradePrompt} from "@/components/premium";
import {buildTrainingAnalytics,type ActivityAnalytics,type AnalyticsBucket,type AnalyticsComparison,type AnalyticsRange} from "@/lib/analytics/training-analytics";
import type {AccessState} from "@/lib/premium/access";
import type {EnduranceSession,Exercise,Workout} from "@/lib/setra/types";
import {formatLoad,type StrengthUnit} from "@/lib/setra/units";
import type {WeekdayIndex} from "@/lib/setra/week";

const ranges:Array<{value:AnalyticsRange;label:string}>=[{value:"4w",label:"4 weeks"},{value:"12w",label:"12 weeks"},{value:"6m",label:"6 months"},{value:"1y",label:"1 year"},{value:"all",label:"All time"}];
const dateLabel=(value:string)=>new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`));
const compact=(value:number,maximumFractionDigits=1)=>new Intl.NumberFormat("en-AU",{notation:value>=10000?"compact":"standard",maximumFractionDigits}).format(value);
const duration=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`:`${Math.round(minutes)}m`;
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,"0")}`;
const changeLabel=(comparison:AnalyticsComparison,range:AnalyticsRange)=>range==="all"?"All recorded training":comparison.previous===0?comparison.current>0?"New in this period":"No previous data":`${comparison.changePercent!>=0?"+":""}${Math.round(comparison.changePercent!)}% vs previous`;
const performanceLabel=(item:ActivityAnalytics,value:number)=>item.performanceKind==="speed"?`${value.toFixed(1)} km/h`:item.performanceKind==="split"?`${clock(value)} /500 m`:item.activityType==="swim"?`${clock(value/10)} /100 m`:`${clock(value)} /km`;

function MetricChart({title,buckets,value,label}:{title:string;buckets:AnalyticsBucket[];value:(bucket:AnalyticsBucket)=>number;label:(bucket:AnalyticsBucket)=>string}){
  const max=Math.max(1,...buckets.map(value));
  if(!buckets.length)return <div className="advanced-empty">No completed training in this period.</div>;
  return <section className="analytics-chart"><header><span>{title}</span><small>{buckets.length} {buckets.length===1?"period":"periods"}</small></header><div className="analytics-chart-bars">{buckets.map(bucket=><div key={bucket.key} title={`${bucket.label}: ${label(bucket)}`}><span style={{height:`${Math.max(value(bucket)>0?8:0,value(bucket)/max*100)}%`}}/><b>{label(bucket)}</b><small>{bucket.label}</small></div>)}</div></section>;
}

function LockedAnalytics(){return <section className="advanced-analytics locked-analytics"><div className="advanced-heading"><span>ADVANCED ANALYTICS</span><h2>See the patterns behind the work.</h2><p>Compare periods, explore strength progression and understand endurance or hybrid training at a glance.</p></div><div className="locked-analytics-preview" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><UpgradePrompt title="Unlock Advanced Analytics" body="Advanced Analytics is included with Premium and Adaptive. Your basic Progress view remains available on Free."/></section>}

export function AdvancedAnalytics({access,accessLoading=false,workouts,enduranceSessions,exercises,showStrength,showEndurance,preferredUnit,today,weekStartsOn,onExercise}:{access:AccessState;accessLoading?:boolean;workouts:Workout[];enduranceSessions:EnduranceSession[];exercises:Exercise[];showStrength:boolean;showEndurance:boolean;preferredUnit:StrengthUnit;today:string;weekStartsOn:WeekdayIndex;onExercise:(id:string)=>void}){
  if(accessLoading)return <section className="advanced-analytics"><div className="advanced-heading"><span>ADVANCED ANALYTICS</span><h2>Loading access…</h2></div></section>;
  return <FeatureGate access={access} feature="advanced_analytics" fallback={<LockedAnalytics/>}><AdvancedAnalyticsContent workouts={workouts} enduranceSessions={enduranceSessions} exercises={exercises} showStrength={showStrength} showEndurance={showEndurance} preferredUnit={preferredUnit} today={today} weekStartsOn={weekStartsOn} onExercise={onExercise}/></FeatureGate>;
}

function AdvancedAnalyticsContent({workouts,enduranceSessions,exercises,showStrength,showEndurance,preferredUnit,today,weekStartsOn,onExercise}:{workouts:Workout[];enduranceSessions:EnduranceSession[];exercises:Exercise[];showStrength:boolean;showEndurance:boolean;preferredUnit:StrengthUnit;today:string;weekStartsOn:WeekdayIndex;onExercise:(id:string)=>void}){
  const [range,setRange]=useState<AnalyticsRange>("12w");
  const analytics=useMemo(()=>buildTrainingAnalytics({workouts,enduranceSessions,exercises,range,today,weekStartsOn}),[workouts,enduranceSessions,exercises,range,today,weekStartsOn]);
  const hybrid=showStrength&&showEndurance;
  const repMax=Math.max(1,...analytics.repRanges.map(item=>item.count));
  return <section className="advanced-analytics">
    <div className="advanced-heading"><span>ADVANCED ANALYTICS</span><h2>Training, in context.</h2><p>{dateLabel(analytics.period.start)} – {dateLabel(analytics.period.end)} · Completed sessions only</p></div>
    <div className="analytics-ranges" role="group" aria-label="Analytics time range">{ranges.map(item=><button className={range===item.value?"active":""} aria-pressed={range===item.value} key={item.value} onClick={()=>setRange(item.value)}>{item.label}</button>)}</div>

    <div className="analytics-summary-grid">
      <article><span>SESSIONS</span><strong>{analytics.totalSessions}</strong><small>{changeLabel(analytics.comparison.sessions,range)}</small></article>
      <article><span>TRAINING TIME</span><strong>{analytics.durationCoverage?duration(analytics.durationMinutes):"Unknown"}</strong><small>{analytics.durationCoverage?`${analytics.durationCoverage} of ${analytics.totalSessions} recorded`:"No reliable duration data"}</small></article>
      {showStrength&&<article><span>STRENGTH VOLUME</span><strong>{formatLoad(analytics.strengthVolumeKg,preferredUnit)}</strong><small>{changeLabel(analytics.comparison.volume,range)}</small></article>}
      {showEndurance&&<article><span>ENDURANCE DISTANCE</span><strong>{compact(analytics.enduranceDistanceKm)} km</strong><small>{changeLabel(analytics.comparison.distance,range)}</small></article>}
    </div>

    {hybrid&&<section className="analytics-panel hybrid-overview"><header><div><span>HYBRID OVERVIEW</span><h3>One training record.</h3></div><small>{analytics.strengthSessions} strength · {analytics.enduranceSessions} endurance</small></header><div className="hybrid-split"><span style={{width:`${analytics.totalSessions?analytics.strengthSessions/analytics.totalSessions*100:50}%`}}/><i/></div><div className="hybrid-legend"><b>Strength {analytics.totalSessions?Math.round(analytics.strengthSessions/analytics.totalSessions*100):0}%</b><b>Endurance {analytics.totalSessions?Math.round(analytics.enduranceSessions/analytics.totalSessions*100):0}%</b></div><div className="activity-chips"><span>Strength · {analytics.strengthSessions}</span>{analytics.activities.map(item=><span key={item.activityType}>{activityLabel(item.activityType)} · {item.sessions}</span>)}</div></section>}

    <div className="analytics-chart-grid">
      {showStrength&&<MetricChart title={`${analytics.period.bucket.toUpperCase()}LY STRENGTH VOLUME`} buckets={analytics.buckets} value={item=>item.strengthVolumeKg} label={item=>item.strengthVolumeKg?formatLoad(item.strengthVolumeKg,preferredUnit):"0"}/>} 
      {showStrength&&<MetricChart title={`${analytics.period.bucket.toUpperCase()}LY SETS`} buckets={analytics.buckets} value={item=>item.sets} label={item=>String(item.sets)}/>} 
      {showEndurance&&<MetricChart title={`${analytics.period.bucket.toUpperCase()}LY DISTANCE`} buckets={analytics.buckets} value={item=>item.distanceKm} label={item=>item.distanceKm?`${compact(item.distanceKm)} km`:"0"}/>} 
      {showEndurance&&<MetricChart title={`${analytics.period.bucket.toUpperCase()}LY ENDURANCE TIME`} buckets={analytics.buckets} value={item=>item.durationMinutes} label={item=>item.durationMinutes?duration(item.durationMinutes):"0"}/>} 
      {showEndurance&&analytics.elevationMetres>0&&<MetricChart title={`${analytics.period.bucket.toUpperCase()}LY ELEVATION`} buckets={analytics.buckets} value={item=>item.elevationMetres} label={item=>item.elevationMetres?`${compact(item.elevationMetres,0)} m`:"0"}/>} 
      {showEndurance&&analytics.heartRateAverage&&<MetricChart title="AVERAGE HEART RATE TREND" buckets={analytics.buckets} value={item=>item.heartRateAverage||0} label={item=>item.heartRateAverage?`${Math.round(item.heartRateAverage)} bpm`:"–"}/>} 
    </div>

    {showStrength&&<section className="analytics-panel"><header><div><span>STRENGTH</span><h3>Exercise patterns</h3></div><small>{analytics.strengthSets} completed sets</small></header><div className="analytics-two-column"><div className="analytics-ranked"><span>TOP BY VOLUME</span>{analytics.topExercisesByVolume.length?analytics.topExercisesByVolume.map((item,index)=><button onClick={()=>onExercise(item.exerciseId)} key={item.exerciseId}><i>{index+1}</i><b>{item.name}</b><em>{formatLoad(item.volumeKg,preferredUnit)}</em></button>):<p>No numeric load and rep volume recorded.</p>}</div><div className="analytics-ranked"><span>EXERCISE FREQUENCY</span>{analytics.exerciseFrequency.length?analytics.exerciseFrequency.map(item=><button onClick={()=>onExercise(item.exerciseId)} key={item.exerciseId}><b>{item.name}</b><em>{item.sessions} {item.sessions===1?"session":"sessions"}</em></button>):<p>No completed exercises in this period.</p>}</div></div><div className="analytics-two-column"><div className="analytics-ranked"><span>LOAD PROGRESSION</span>{analytics.loadProgression.length?analytics.loadProgression.map(item=><button onClick={()=>onExercise(item.exerciseId)} key={item.exerciseId}><b>{item.name}</b><small>{formatLoad(item.firstMaxLoadKg||0,preferredUnit)} → {formatLoad(item.lastMaxLoadKg||0,preferredUnit)}</small><em>{item.loadChangeKg===0?"No change":`${item.loadChangeKg!>0?"+":""}${formatLoad(item.loadChangeKg!,preferredUnit)}`}</em></button>):<p>At least two loaded sessions for an exercise are needed.</p>}</div><div className="rep-ranges"><span>REP-RANGE DISTRIBUTION</span>{analytics.repRanges.map(item=><div key={item.label}><small>{item.label}</small><i><b style={{width:`${item.count/repMax*100}%`}}/></i><em>{item.count}</em></div>)}</div></div></section>}

    {showEndurance&&<section className="analytics-panel"><header><div><span>ENDURANCE</span><h3>Activity mix and trends</h3></div><small>{analytics.activities.length} {analytics.activities.length===1?"activity type":"activity types"}</small></header>{analytics.activities.length?<div className="endurance-analytics-list">{analytics.activities.map(item=><article key={item.activityType}><ActivityIcon type={item.activityType}/><div><b>{activityLabel(item.activityType)}</b><small>{item.sessions} sessions · {item.distanceKm?`${compact(item.distanceKm)} km · `:""}{item.durationMinutes?duration(item.durationMinutes):"duration unknown"}</small></div><div>{item.latestPerformance&&item.performanceKind?<strong>{performanceLabel(item,item.latestPerformance)}</strong>:<strong>No pace data</strong>}<small>{item.firstPerformance&&item.latestPerformance&&item.firstPerformance!==item.latestPerformance?`${performanceLabel(item,item.firstPerformance)} → ${performanceLabel(item,item.latestPerformance)}`:item.averageHeartRate?`${Math.round(item.averageHeartRate)} bpm avg`:item.elevationMetres?`${compact(item.elevationMetres,0)} m elevation`:"Recorded metrics vary"}</small></div></article>)}</div>:<div className="advanced-empty">Complete an endurance activity to begin building analytics.</div>}<div className="analytics-supporting-metrics">{analytics.elevationMetres>0&&<div><span>ELEVATION</span><b>{compact(analytics.elevationMetres,0)} m</b></div>}{analytics.heartRateAverage&&<div><span>AVERAGE HR</span><b>{Math.round(analytics.heartRateAverage)} bpm</b></div>}</div></section>}

    <section className="analytics-panel period-comparison"><header><div><span>PERIOD COMPARISON</span><h3>{range==="all"?"All recorded training":"Current vs previous period"}</h3></div></header><div>{[{label:"Sessions",metric:analytics.comparison.sessions,value:String(analytics.totalSessions)},{label:"Training time",metric:analytics.comparison.duration,value:analytics.durationCoverage?duration(analytics.durationMinutes):"Unknown"},...(showStrength?[{label:"Strength volume",metric:analytics.comparison.volume,value:formatLoad(analytics.strengthVolumeKg,preferredUnit)},{label:"Completed sets",metric:analytics.comparison.sets,value:String(analytics.strengthSets)}]:[]),...(showEndurance?[{label:"Endurance distance",metric:analytics.comparison.distance,value:`${compact(analytics.enduranceDistanceKm)} km`}]:[])].map(item=><article key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{changeLabel(item.metric,range)}</small></article>)}</div></section>
  </section>;
}

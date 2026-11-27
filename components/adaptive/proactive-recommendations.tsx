"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {UpgradePrompt} from "@/components/premium";
import {hasFeature,type AccessState} from "@/lib/premium/access";
import type {RecommendationType,StoredRecommendation} from "@/lib/adaptive/recommendation-types";
import {ProposePlanChange} from "./plan-adjustments";

type Feed={recommendations:StoredRecommendation[];candidateCount:number;sourceHash:string;canGenerate:boolean;evaluationStatus:string|null};
const labels:Record<RecommendationType,string>={progress:"Progress",maintain:"Maintain",reduce:"Reduce",schedule:"Schedule",goal:"Goal",recovery_consideration:"Recovery consideration"};
async function loadRecommendations(){const response=await fetch("/api/adaptive/recommendations",{cache:"no-store"});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||"Recommendations could not be loaded.");return response.json() as Promise<Feed>}
async function generateRecommendations(trigger:"weekly_review"|"training_change"|"manual"){const response=await fetch("/api/adaptive/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trigger})});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Recommendations could not be refreshed.");return payload as Feed}

export function ProactiveRecommendationsBootstrap({access,loading}:{access:AccessState;loading:boolean}){
  const timer=useRef<number|null>(null);
  useEffect(()=>{if(loading||!hasFeature(access,"ai_recommendations"))return;const queue=(trigger:"weekly_review"|"training_change")=>{if(timer.current)window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>{generateRecommendations(trigger).then(loadRecommendations).then(payload=>window.dispatchEvent(new CustomEvent("setra-adaptive-recommendations-ready",{detail:payload}))).catch(()=>undefined)},1200)};const training=()=>queue("training_change"),review=()=>queue("weekly_review");window.addEventListener("setra-training-changed",training);window.addEventListener("setra-adaptive-weekly-review-generated",review);return()=>{window.removeEventListener("setra-training-changed",training);window.removeEventListener("setra-adaptive-weekly-review-generated",review);if(timer.current)window.clearTimeout(timer.current)}},[access,loading]);
  return null;
}

export function ProactiveRecommendations({access,accessLoading=false}:{access:AccessState;accessLoading?:boolean}){
  const [feed,setFeed]=useState<Feed|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const refresh=useCallback(async()=>{setError("");try{setFeed(await loadRecommendations())}catch(caught){setError(caught instanceof Error?caught.message:"Recommendations could not be loaded.")}},[]);
  useEffect(()=>{if(!accessLoading&&hasFeature(access,"ai_recommendations"))void refresh()},[access,accessLoading,refresh]);
  useEffect(()=>{const ready=(event:Event)=>{const detail=(event as CustomEvent<Feed>).detail;if(detail?.recommendations)setFeed(current=>({...current,...detail} as Feed));else void refresh()};window.addEventListener("setra-adaptive-recommendations-ready",ready);return()=>window.removeEventListener("setra-adaptive-recommendations-ready",ready)},[refresh]);
  const generate=async()=>{setBusy(true);setError("");try{await generateRecommendations("manual");await refresh()}catch(caught){setError(caught instanceof Error?caught.message:"Recommendations could not be refreshed.")}finally{setBusy(false)}};
  const dismiss=async(id:string)=>{setError("");setFeed(current=>current?{...current,recommendations:current.recommendations.filter(item=>item.id!==id)}:current);const response=await fetch("/api/adaptive/recommendations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:"dismiss"})});if(!response.ok){setError((await response.json().catch(()=>null))?.error||"The recommendation could not be dismissed.");await refresh()}};
  if(accessLoading)return <section id="adaptive-recommendations" className="adaptive-recommendations"><div className="advanced-heading"><span>SETRA ADAPTIVE</span><h2>Loading recommendations…</h2></div></section>;
  if(!hasFeature(access,"ai_recommendations"))return <section id="adaptive-recommendations" className="adaptive-recommendations adaptive-recommendations-locked"><div className="advanced-heading"><span>RECOMMENDATIONS</span><h2>Useful next steps, grounded in your work.</h2><p>Adaptive checks for a small number of supported progression, volume, recovery, scheduling and goal considerations.</p></div><UpgradePrompt plan="adaptive" title="Unlock Proactive Recommendations" body="Recommendations are included with Adaptive and never change your plan automatically." linkLabel="Explore Adaptive"/></section>;
  return <section id="adaptive-recommendations" className="adaptive-recommendations">
    <header><div><span>SETRA ADAPTIVE</span><h2>Recommendations</h2><p>Forward-looking considerations based on meaningful recorded evidence.</p></div><button type="button" disabled={busy} onClick={generate}>{busy?"Checking…":"Refresh"}</button></header>
    {!feed&&!error&&<div className="adaptive-recommendations-state">Checking for supported recommendations…</div>}
    {feed&&feed.recommendations.length===0&&<div className="adaptive-recommendations-state"><b>No recommendations right now</b><p>{feed.canGenerate?"Setra found supported evidence that can be reviewed when you refresh.":feed.evaluationStatus==="generating"?"Eligible evidence is currently being reviewed.":feed.candidateCount?"No current recommendation remains for this evidence.":"Setra did not find enough meaningful evidence to suggest a change. That is a valid result."}</p></div>}
    {feed?.recommendations.slice(0,3).map(item=><article key={item.id}><div className="adaptive-recommendation-copy"><span>{labels[item.type]} · {item.confidence} confidence</span><h3>{item.title}</h3><p>{item.recommendation}</p><details><summary>View evidence</summary><ul>{item.evidence.map((evidence,index)=><li key={index}>{evidence}</li>)}</ul></details></div><div className="adaptive-recommendation-actions"><ProposePlanChange access={access} source={{kind:"recommendation",id:item.id}}/><button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("setra-ask-question",{detail:{question:`Help me understand this recommendation: ${item.title}. Evidence: ${item.evidence.join(" ")}`}}))}>Ask Setra</button><button type="button" onClick={()=>void dismiss(item.id)}>Dismiss</button></div></article>)}
    {error&&<p className="adaptive-recommendations-error" role="alert">{error}</p>}
    <small>Recommendations are advisory. Setra will not alter workouts, goals or programs without a future explicit approval flow.</small>
  </section>;
}

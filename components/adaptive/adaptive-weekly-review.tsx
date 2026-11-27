"use client";

import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {UpgradePrompt} from "@/components/premium";
import {hasFeature,type AccessState} from "@/lib/premium/access";
import type {StoredWeeklyReview} from "@/lib/adaptive/weekly-review-types";
import {ProposePlanChange} from "./plan-adjustments";

type ReviewFeed={targetWeekStart:string;targetWeekEnd:string;sourceHash:string;sourceChanged:boolean;needsGeneration:boolean;canGenerate:boolean;reviews:StoredWeeklyReview[]};
const dateRange=(start:string,end:string)=>`${new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(new Date(`${start}T12:00:00`))}–${new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${end}T12:00:00`))}`;

async function loadFeed(){const response=await fetch("/api/adaptive/weekly-review",{cache:"no-store"});if(!response.ok)throw new Error((await response.json().catch(()=>null))?.error||"Weekly reviews could not be loaded.");return response.json() as Promise<ReviewFeed>}
async function generateReview(weekStart?:string,regenerate=false){const response=await fetch("/api/adaptive/weekly-review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({weekStart,regenerate})});const payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||payload?.review?.errorMessage||"The weekly review could not be generated.");const review=payload.review as StoredWeeklyReview;if(review.status==="ready"&&payload.generated)window.dispatchEvent(new Event("setra-adaptive-weekly-review-generated"));return review}

export function AdaptiveWeeklyReviewBootstrap({access,loading}:{access:AccessState;loading:boolean}){
  const attempted=useRef(false);
  useEffect(()=>{if(loading||!hasFeature(access,"ai_weekly_review")||attempted.current)return;attempted.current=true;loadFeed().then(feed=>{if(feed.needsGeneration)return generateReview(feed.targetWeekStart)}).then(review=>{if(review?.status==="ready")window.dispatchEvent(new CustomEvent("setra-adaptive-review-ready",{detail:review}))}).catch(()=>undefined)},[access,loading]);
  return null;
}

export function AdaptiveWeeklyReviewPrompt({access,loading}:{access:AccessState;loading:boolean}){
  const [review,setReview]=useState<StoredWeeklyReview|null>(null);
  useEffect(()=>{if(loading||!hasFeature(access,"ai_weekly_review"))return;loadFeed().then(feed=>setReview(feed.reviews.find(item=>item.status==="ready")||null)).catch(()=>undefined);const listener=(event:Event)=>setReview((event as CustomEvent<StoredWeeklyReview>).detail);window.addEventListener("setra-adaptive-review-ready",listener);return()=>window.removeEventListener("setra-adaptive-review-ready",listener)},[access,loading]);
  if(loading||!hasFeature(access,"ai_weekly_review")||!review)return null;
  return <Link className="adaptive-home-prompt" href="/?tab=history&view=progress#adaptive-weekly-review"><span>ADAPTIVE WEEKLY REVIEW</span><b>{dateRange(review.weekStart,review.weekEnd)}</b><em>Read review ›</em></Link>;
}

export function AdaptiveWeeklyReview({access,accessLoading=false}:{access:AccessState;accessLoading?:boolean}){
  const [feed,setFeed]=useState<ReviewFeed|null>(null);const [selected,setSelected]=useState<string>("");const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const refresh=useCallback(async()=>{setError("");try{const next=await loadFeed();setFeed(next);setSelected(current=>current||next.reviews.find(item=>item.content)?.weekStart||next.targetWeekStart)}catch(caught){setError(caught instanceof Error?caught.message:"Weekly reviews could not be loaded.")}},[]);
  useEffect(()=>{if(!accessLoading&&hasFeature(access,"ai_weekly_review"))void refresh()},[access,accessLoading,refresh]);
  const generate=async()=>{if(!feed)return;const target=feed.reviews.find(item=>item.weekStart===feed.targetWeekStart);setBusy(true);setError("");try{const review=await generateReview(feed.targetWeekStart,Boolean(feed.sourceChanged||target?.status==="failed"));await refresh();setSelected(review.weekStart)}catch(caught){setError(caught instanceof Error?caught.message:"The weekly review could not be generated.")}finally{setBusy(false)}};
  if(accessLoading)return <section id="adaptive-weekly-review" className="adaptive-review"><div className="advanced-heading"><span>SETRA ADAPTIVE</span><h2>Loading weekly review…</h2></div></section>;
  if(!hasFeature(access,"ai_weekly_review"))return <section id="adaptive-weekly-review" className="adaptive-review adaptive-locked"><div className="advanced-heading"><span>SETRA ADAPTIVE</span><h2>Your training week, in context.</h2><p>A concise review grounded in planned work, completed sessions, check-ins and current goals.</p></div><UpgradePrompt plan="adaptive" title="Unlock Weekly Training Review" body="Weekly Training Review is included with Adaptive. Free and Premium training data remain unchanged." linkLabel="Explore Adaptive"/></section>;
  const review=feed?.reviews.find(item=>item.weekStart===selected)||null;const content=review?.content;const target=feed?.reviews.find(item=>item.weekStart===feed.targetWeekStart);const targetPending=Boolean(feed&&target?.status!=="ready");
  return <section id="adaptive-weekly-review" className="adaptive-review">
    <header className="adaptive-review-header"><div><span>SETRA ADAPTIVE</span><h2>Weekly Training Review</h2><p>{review?dateRange(review.weekStart,review.weekEnd):feed?dateRange(feed.targetWeekStart,feed.targetWeekEnd):"Your completed training week"}</p></div>{feed?.reviews.some(item=>item.content)&&<label>Review week<select value={selected} onChange={event=>setSelected(event.target.value)}>{feed.reviews.filter(item=>item.content).map(item=><option value={item.weekStart} key={item.id}>{dateRange(item.weekStart,item.weekEnd)}</option>)}</select></label>}</header>
    {!feed&&!error&&<div className="adaptive-review-state">Loading your training context…</div>}
    {feed?.canGenerate&&targetPending&&content&&<div className="adaptive-review-updated"><div><b>{target?.status==="failed"?"This week’s review needs another try.":"A new completed week is ready to review."}</b><small>{dateRange(feed.targetWeekStart,feed.targetWeekEnd)}</small></div><button disabled={busy} onClick={generate}>{busy?"Generating…":"Generate review"}</button></div>}
    {feed&&!content&&(feed.canGenerate?<div className="adaptive-review-state"><h3>{busy?"Reviewing the week…":"Your review is ready to generate."}</h3><p>Setra will use a compact summary of the completed week, comparisons, check-ins and goals. Raw training history is not sent.</p><button disabled={busy} onClick={generate}>{busy?"Generating…":"Generate weekly review"}</button></div>:<div className="adaptive-review-state">No planned or completed training to review for that week.</div>)}
    {content&&<>
      <div className="adaptive-review-glance"><span>WEEK AT A GLANCE</span>{content.weekAtAGlance.map((item,index)=><p key={index}>{item}</p>)}</div>
      <div className="adaptive-review-sections"><ReviewSection title="What went well" items={content.whatWentWell}/><ReviewSection title="Worth noting" items={content.worthNoting}/><ReviewSection title="Looking ahead" items={content.lookingAhead}/></div>
      <footer className="adaptive-confidence"><div><span>DATA CONFIDENCE · {content.dataConfidence.level.toUpperCase()}</span><p>{content.dataConfidence.summary}</p></div>{content.dataConfidence.gaps.length>0&&<details><summary>Data gaps</summary><ul>{content.dataConfidence.gaps.map((item,index)=><li key={index}>{item}</li>)}</ul></details>}</footer>
      <button className="adaptive-ask-link" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("setra-ask-question",{detail:{question:`What else should I understand about my training for ${dateRange(review!.weekStart,review!.weekEnd)}?`}}))}>Ask Setra about this week ›</button>
      {review?.weekStart===feed?.targetWeekStart&&review&&<ProposePlanChange access={access} source={{kind:"review",id:review.id}}/>}
      {feed?.canGenerate&&!targetPending&&feed.sourceChanged&&review?.weekStart===feed.targetWeekStart&&<div className="adaptive-review-updated"><div><b>Your training record changed.</b><small>Generate an updated review using the latest completed data.</small></div><button disabled={busy} onClick={generate}>{busy?"Updating…":"Update review"}</button></div>}
    </>}
    {error&&<p className="adaptive-review-error" role="alert">{error}</p>}
    <small className="adaptive-review-note">Setra provides training context, not medical advice. If pain, illness or unusual symptoms affect training, seek appropriate professional guidance.</small>
  </section>;
}

function ReviewSection({title,items}:{title:string;items:string[]}){return <article><h3>{title}</h3><ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul></article>}

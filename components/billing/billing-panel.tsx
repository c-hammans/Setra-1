"use client";

import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {billingOffers,terminalStatus,type BillingCadence,type BillingKind,type BillingPublicState} from "@/lib/billing/catalogue";
import "./billing.css";

const labels:Record<string,string>={active:"Active",trialing:"Trial",past_due:"Payment overdue",unpaid:"Unpaid",incomplete:"Payment incomplete",
  incomplete_expired:"Checkout expired",paused:"Paused",canceled:"Canceled",conflict:"Multiple subscriptions need review",unmapped:"Plan needs review",pending_payment:"Awaiting payment"};
const money=(cents:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",currencyDisplay:"code"}).format(cents/100);
const dateLabel=(value:string)=>new Intl.DateTimeFormat("en-AU",{dateStyle:"medium"}).format(new Date(value));
const endpoint="/api/billing";

async function loadBilling(){
  const response=await fetch(endpoint,{cache:"no-store"});
  if(!response.ok)throw new Error("Billing status couldn’t be loaded.");
  return response.json() as Promise<BillingPublicState>;
}

export function BillingPanel({kind,seatVersion=0,onState}:{kind:BillingKind;seatVersion?:number;onState?:(value:BillingPublicState)=>void}){
  const [cadence,setCadence]=useState<BillingCadence>("month"),[state,setState]=useState<BillingPublicState|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState("");
  const [returned,setReturned]=useState("");
  const active=useRef(false),previousAccess=useRef(""),operation=useRef(false),onStateRef=useRef(onState);
  useEffect(()=>{onStateRef.current=onState},[onState]);
  const refresh=useCallback(async()=>{
    try{
      const next=await loadBilling();if(!active.current)return;
      setState(next);onStateRef.current?.(next);setError("");
      const accessStamp=JSON.stringify([next.plan,next.subscriptions.coaching?.funded,next.subscriptions.coaching?.status]);
      if(previousAccess.current&&previousAccess.current!==accessStamp)window.dispatchEvent(new Event("setra-billing-updated"));
      previousAccess.current=accessStamp;
    }catch(error){if(active.current)setError((error as Error).message)}
  },[]);
  useEffect(()=>{
    active.current=true;
    const status=new URLSearchParams(window.location.search).get("billing")??"";
    setReturned(status);void refresh();
    const timer=status==="return"?window.setTimeout(()=>void refresh(),3500):null;
    return ()=>{active.current=false;if(timer!=null)window.clearTimeout(timer)};
  },[refresh,seatVersion]);

  async function action(name:"checkout"|"portal"|"fund",fields:object,token:string){
    if(operation.current)return;
    operation.current=true;setBusy(token);setError("");
    try{
      const result=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:name,kind,...fields})});
      const data=await result.json().catch(()=>null);
      if(!result.ok)throw new Error(data?.error??"Billing couldn’t complete this action.");
      if(data?.url){window.location.assign(data.url);return}
      await refresh();
    }catch(error){setError((error as Error).message)}
    finally{setBusy("");operation.current=false}
  }
  const sub=state?.subscriptions[kind], managing=!!sub?.status&&!terminalStatus(sub.status);
  const seats=state?.seats, available=seats?.limit==null?null:Math.max(0,seats.limit-seats.active-seats.pending);
  const over=seats?.limit!=null&&seats.active>seats.limit;
  const options=billingOffers.filter(item=>item.kind===kind&&(kind==="coaching"||item.cadence===cadence));
  const product=billingOffers.find(item=>item.product===sub?.product)?.name;
  const canFund=!!sub?.funded&&seats?.limit!=null&&!over&&seats.limit>0;
  return <section id="test-billing" className="billing-panel" aria-labelledby={kind+"-billing-title"}>
    <header><span>STRIPE TEST MODE · NO REAL CHARGES</span><h2 id={kind+"-billing-title"}>{kind==="individual"?"Individual subscriptions":"Coaching subscriptions"}</h2>
      <p>{kind==="individual"?"Individual billing is independent of coaching. Beta access is not billed.":"A coaching subscription is separate from your individual plan. Each active client uses one seat."}</p>
    </header>
    {!state&&!error&&<p role="status">Loading billing…</p>}
    {state&&!state.configured&&<p>Test billing isn’t configured on this site. Your existing access is unchanged.</p>}
    {returned==="return"&&<p role="status">Returned from Stripe. Setra updates access after confirming billing; returning from Checkout doesn’t unlock features by itself.</p>}
    {returned==="cancel"&&<p role="status">You left Checkout. Check your billing status to see any existing subscription.</p>}
    {sub?.status&&<div className="billing-current">
      <strong>{product??"Subscription"} · {labels[sub.status]??sub.status}</strong>
      {sub.cadence&&<p>Billed {sub.cadence==="month"?"monthly":"annually"}.</p>}
      {sub.until&&<p>{sub.cancelAtEnd?"Ends":sub.funded?"Current period ends":"Last known period end"} {dateLabel(sub.until)}.</p>}
      {!sub.funded&&managing&&<p>Stripe-funded access is paused. Open the portal to review or update your payment details.</p>}
    </div>}
    {kind==="individual"&&state?.manualPlan&&state.manualPlan!=="free"&&<p>Separate beta or manual access: <strong>{state.manualPlan}</strong>. Stripe changes do not remove it.</p>}
    {kind==="coaching"&&seats&&<div className="billing-current">
      <strong>{seats.limit==null?"Legacy workspace":`${seats.active} / ${seats.limit} active seats`}</strong>
      <p>{seats.pending} pending {seats.pending===1?"invitation":"invitations"}{available!=null?` · ${available} available to invite`:""}.</p>
      {(over||seats.limit===0&&seats.pending>0)&&<p>Client relationships and training have been kept. Restore or upgrade your coaching plan, or <a href="#coach-active-clients">review your relationships</a>. New assignments and funded client access are paused while your active clients are above capacity or billing is inactive.</p>}
      {!over&&available===0&&seats.limit!==0&&<p>At capacity. Upgrade or free a seat before inviting another client.</p>}
    </div>}
    <div className="billing-actions">
      {kind==="coaching"&&available===0&&sub?.funded&&sub.hasCustomer&&state?.configured&&<button type="button" className="billing-primary" disabled={!!busy} onClick={()=>void action("portal",{},"upgrade")}>{busy==="upgrade"?"Opening Stripe…":"Upgrade coaching plan"}</button>}
      {sub?.hasCustomer&&state?.configured&&<button type="button" disabled={!!busy} onClick={()=>void action("portal",{},"portal")}>{busy==="portal"?"Opening Stripe…":"Manage subscription and invoices"}</button>}
      {state?.configured&&<button type="button" onClick={()=>void refresh()}>Refresh status</button>}
    </div>
    {kind==="individual"&&<fieldset className="billing-cadence"><legend>Billing interval</legend>
      <label><input type="radio" name="billing-cadence" checked={cadence==="month"} onChange={()=>setCadence("month")}/> Monthly</label>
      <label><input type="radio" name="billing-cadence" checked={cadence==="year"} onChange={()=>setCadence("year")}/> Annual</label>
    </fieldset>}
    <div className="billing-offers">{kind==="individual"&&<article><h3>Free</h3><p>{money(0)} · Core training</p>{managing&&<small>Use Manage subscription to cancel at period end.</small>}</article>}
      {options.map(offer=><article key={offer.id}><h3>{offer.name}</h3><p><strong>{money(offer.cents)}</strong> / {offer.cadence}</p>
        {"seats" in offer&&<p>{offer.seats} active client seats</p>}
        {state?.configured&&!managing&&<button className="billing-primary" type="button" disabled={!!busy} onClick={()=>void action("checkout",{offer:offer.id},offer.id)}>{busy===offer.id?"Opening Stripe…":`Test checkout: ${offer.name}`}</button>}
        {managing&&sub?.product===offer.product&&sub.cadence===offer.cadence&&<small>Current Stripe option</small>}
      </article>)}
    </div>
    {kind==="coaching"&&!!state?.clients.length&&(seats?.limit!=null||state.clients.some(item=>item.funded))&&<details className="billing-client-funding">
      <summary>Manage client Premium funding</summary><p>Funding grants Premium to this active client without changing their individual plan. It stops if the relationship ends or your paid coaching access is paused.</p>
      {state.clients.map(item=><div key={item.id}><Link href={`/coaching/${item.id}`}>{item.name}</Link>
        <button type="button" disabled={!!busy||!canFund&&!item.funded} onClick={()=>void action("fund",{relationship:item.id,enabled:!item.funded},item.id)}>{item.funded?"Stop funding Premium":"Fund Premium"}</button>
      </div>)}
    </details>}
    {error&&<p className="billing-error" role="alert">{error}</p>}
  </section>;
}

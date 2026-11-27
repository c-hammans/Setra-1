"use client";

import Link from "next/link";
import {useRef,useState} from "react";
import {billingOffers} from "@/lib/billing/catalogue";
import {FEATURE_CATALOGUE,PLAN_CATALOGUE,type AccessState,type FeatureKey} from "@/lib/premium/access";
import {plusFeatures,plusFeatureStatus,plusOfferedPlans,plusTiers} from "@/lib/premium/plus";
import "./plus-feature-hub.css";

const price=(cents:number)=>new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",currencyDisplay:"code"}).format(cents/100);
const featureLabel=(key:FeatureKey)=>key==="ai_weekly_review"?"Weekly Training Review":FEATURE_CATALOGUE[key].title;
function LockIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5M12 14.5v2"/></svg>}

export function PlusFeatureHub({access,loading=false}:{access:AccessState;loading?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [selected,setSelected]=useState<FeatureKey|null>(null);
  const [showUpcoming,setShowUpcoming]=useState(false);
  const openPlans=(feature:FeatureKey)=>{
    setSelected(feature);
    if(!dialog.current?.open)dialog.current?.showModal();
  };
  const upcoming=selected&&plusFeatureStatus(access,selected).state==="upcoming";
  return <section className="plus-feature-hub" aria-labelledby="plus-heading">
    <header className="plus-intro">
      <div><span>SETRA</span><h1 id="plus-heading">Plus</h1><p>Explore Premium analytics and Adaptive training tools.</p></div>
      <div className="plus-current"><b>{loading?"Checking access…":`${PLAN_CATALOGUE[access.plan].displayName} access`}</b><a href="#plans">Compare plans</a></div>
    </header>
    {plusTiers.map(tier=>{
      const features=plusFeatures(tier);
      const ready=features.filter(item=>plusFeatureStatus(access,item).state!=="upcoming");
      const upcoming=features.filter(item=>plusFeatureStatus(access,item).state==="upcoming");
      return <section className="plus-category" key={tier} aria-label={PLAN_CATALOGUE[tier].displayName+" features"}>
        <header><h2>{PLAN_CATALOGUE[tier].displayName}</h2>{tier==="adaptive"&&<p>Includes Premium</p>}</header>
        <ul>{(showUpcoming?[...ready,...upcoming]:ready).map(key=>{
          const status=plusFeatureStatus(access,key);
          const content=<><span className="plus-feature-copy"><strong>{featureLabel(key)}</strong><small>{FEATURE_CATALOGUE[key].description}</small></span>
            <span className="plus-feature-indicator">{status.state==="open"?<><span>Open</span><b aria-hidden="true">›</b></>:status.state==="upcoming"?<span>Coming soon</span>:<><LockIcon/><span>{loading?"Checking":"Locked"}</span></>}</span></>;
          return <li key={key}>{status.state==="open"?<Link className="plus-feature-row" href={status.href}>{content}</Link>:
            <button className="plus-feature-row" type="button" disabled={loading} aria-haspopup="dialog" onClick={()=>openPlans(key)}>{content}</button>}</li>;
        })}</ul>
      </section>;
    })}
    <button type="button" className="plus-roadmap" aria-expanded={showUpcoming} onClick={()=>setShowUpcoming(value=>!value)}>{showUpcoming?"Hide upcoming features":"Show upcoming features"}</button>
    <dialog className="plus-plans-dialog" ref={dialog} aria-labelledby="plus-dialog-title">
      <header><h2 id="plus-dialog-title">{selected?featureLabel(selected):"Plan options"}</h2><button type="button" aria-label="Close plan options" onClick={()=>dialog.current?.close()}>×</button></header>
      {selected&&<>
        <p>{upcoming?"Coming soon. Changing plans won’t unlock this feature yet.":"Available on the following Setra plans:"}</p>
        <div className="plus-dialog-plans">{plusOfferedPlans(selected).map(tier=><article key={tier}>
          <h3>{PLAN_CATALOGUE[tier].displayName}</h3>
          <p>{tier==="premium"?"Advanced analytics and the full core training diary.":"Everything in Premium, plus AI-powered training tools."}</p>
          <p>{billingOffers.filter(item=>item.product===tier).map(item=>`${price(item.cents)} / ${item.cadence}`).join(" · ")}</p>
        </article>)}</div>
        <p className="plus-test-note">Pricing is for Stripe test mode only. Live payments are not enabled.</p>
        <a className="plus-plan-link" href="#plans" onClick={()=>dialog.current?.close()}>Compare plans</a>
      </>}
    </dialog>
  </section>;
}

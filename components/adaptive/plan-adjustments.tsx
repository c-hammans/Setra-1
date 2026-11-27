"use client";

import {useEffect,useRef,useState} from "react";
import {planChangeFeatures,type PlanProposal,type PlanSource,type Scalar} from "@/lib/adaptive/plan-adjustments";
import {hasFeature,type AccessState} from "@/lib/premium/access";

type Feed={proposals:PlanProposal[];first:string;last:string};
const endpoint="/api/adaptive/plan-adjustments";
const dateLabel=(date:string)=>new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"numeric",month:"short"}).format(new Date(date+"T12:00:00"));
const unit=(value?:string)=>({seconds_per_km:"sec/km",seconds_per_100m:"sec/100 m",seconds_per_500m:"sec/500 m"})[value as "seconds_per_km"]??value;
const isDate=(key:string)=>key==="date"||key==="add";
const display=(value:Scalar,key:string,suffix?:string)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&isDate(key)?dateLabel(value):[value,unit(suffix)].filter(value=>value!==undefined).join(" ");

export function ProposePlanChange({access,source}:{access:AccessState;source:PlanSource}){
  if(!planChangeFeatures.every(feature=>hasFeature(access,feature)))return null;
  return <button className="plan-propose-button" type="button" onClick={()=>window.dispatchEvent(new CustomEvent("setra-plan-propose",{detail:source}))}>Propose change</button>;
}

async function call<T>(method="GET",body?:unknown):Promise<T>{
  const result=await fetch(endpoint,{method,cache:"no-store",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await result.json().catch(()=>null);
  if(!result.ok||!data)throw new Error(data?.error??"Setra couldn’t open that plan preview.");
  return data as T;
}

export function PlanAdjustments({access,canChange,onChanged}:{access:AccessState;canChange:()=>boolean;onChanged:()=>void}){
  const enabled=planChangeFeatures.every(feature=>hasFeature(access,feature));
  const dialog=useRef<HTMLDialogElement>(null), inFlight=useRef(false);
  const [preview,setPreview]=useState<PlanProposal|null>(null),[feed,setFeed]=useState<Feed|null>(null);
  const [values,setValues]=useState<Record<string,Scalar>>({}),[chosen,setChosen]=useState<string[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[editing,setEditing]=useState(false);
  const pick=(item:PlanProposal|null)=>{
    setPreview(item);setChosen(item?.options.map(option=>option.id)??[]);
    setValues(Object.fromEntries(item?.options.map(option=>[option.id,option.proposed])??[]));
    setEditing(false);
  };
  const load=async()=>{const next=await call<Feed>();setFeed(next);return next};
  useEffect(()=>{
    if(!enabled)return;
    const handle=(event:Event)=>{
      if(inFlight.current)return;
      const source=(event as CustomEvent<PlanSource>).detail;
      if(!dialog.current?.open)dialog.current?.showModal();
      setError("");pick(null);
      if(!canChange()){setError("Finish or close your workout and sync any pending changes before preparing a plan preview.");return}
      inFlight.current=true;setBusy(true);
      void (async()=>{
        try {await load();const data=await call<{proposal:PlanProposal}>("POST",source);pick(data.proposal);await load()}
        catch(error){setError((error as Error).message)}
        finally{setBusy(false);inFlight.current=false}
      })();
    };
    window.addEventListener("setra-plan-propose",handle);
    return ()=>window.removeEventListener("setra-plan-propose",handle);
  },[enabled,canChange]);
  if(!enabled)return null;

  const history=async()=>{if(inFlight.current)return;pick(null);setError("");if(!dialog.current?.open)dialog.current?.showModal();setBusy(true);inFlight.current=true;
    try{await load()}catch(error){setError((error as Error).message)}finally{setBusy(false);inFlight.current=false}};
  const change=async(action:"apply"|"undo"|"decline")=>{
    if(!preview||inFlight.current)return;
    if(action!=="decline"&&!canChange()){setError("Finish or close your workout and sync any pending changes before changing the plan.");return}
    inFlight.current=true;setBusy(true);setError("");
    try{
      const next=await call<{proposal:PlanProposal}>("PATCH",{id:preview.id,action,changes:chosen.map(optionId=>({optionId,value:values[optionId]}))});
      pick(next.proposal);
      if(next.proposal.status==="applied"||next.proposal.status==="reverted")onChanged();
      await load();
    }catch(error){setError((error as Error).message);await load().then(next=>{const current=next.proposals.find(item=>item.id===preview.id);if(current&&current.status!==preview.status)pick(current)}).catch(()=>{})}
    finally{setBusy(false);inFlight.current=false}
  };
  const labels={proposed:"Ready for approval",applied:"Applied",declined:"Declined",expired:"Expired",reverted:"Undone"};
  return <section className="plan-adjustments">
    <button type="button" className="plan-propose-button" onClick={()=>void history()}>Plan adjustment history</button>
    <dialog ref={dialog} className="plan-approval-dialog" aria-labelledby="plan-approval-title" onCancel={event=>{if(inFlight.current)event.preventDefault()}}>
      <header><h2 id="plan-approval-title">{preview?"Plan adjustment":"Plan adjustment history"}</h2><button type="button" aria-label="Close plan adjustment" disabled={busy} onClick={()=>dialog.current?.close()}>×</button></header>
      {busy&&<p role="status">Checking your plan…</p>}
      {error&&<p className="plan-approval-error" role="alert">{error}</p>}
      {preview?<div className="plan-approval-preview">
        <div><strong>{labels[preview.status]}</strong><p>{preview.reason}</p></div>
        {(preview.status==="applied"||preview.status==="reverted"?preview.accepted.map(item=>item.option):preview.options).map(option=>{
          const key=option.field.key, value=preview.accepted.find(item=>item.option.id===option.id)?.value??values[option.id]??option.proposed;
          return <article key={option.id}>
            <h3>{option.session.title}</h3><p>{dateLabel(option.session.date)} · {option.session.modality}</p>
            {preview.status==="proposed"&&<label className="plan-approval-check"><input type="checkbox" checked={chosen.includes(option.id)} disabled={busy} onChange={e=>setChosen(previous=>e.target.checked?[...previous,option.id]:previous.filter(id=>id!==option.id))}/> Include this change</label>}
            <dl><dt>{option.field.label} now</dt><dd>{display(option.field.value,key,option.field.unit)}</dd><dt>{preview.status==="applied"||preview.status==="reverted"?"Accepted":"Proposed"}</dt>
              <dd>{editing&&preview.status==="proposed"&&(isDate(key)||typeof option.proposed==="number")?
                <input aria-label={`Proposed ${option.field.label}`} type={isDate(key)?"date":"number"}
                  min={isDate(key)?feed?.first:option.min} max={isDate(key)?feed?.last:option.max} step={option.step}
                  value={value} onChange={e=>setValues(current=>({...current,[option.id]:isDate(key)||e.target.value===""?e.target.value:e.target.valueAsNumber}))}/>
                :display(value,key,option.field.unit)}</dd></dl>
            {preview.status==="proposed"&&option.session.fields.length>1&&<details><summary>Current recorded prescription</summary><ul>{option.session.fields.map(field=><li key={field.key}>{field.label}: {display(field.value,field.key,field.unit)}</li>)}</ul></details>}
            <details open><summary>Supporting training data</summary><ul>{(option.evidence??preview.evidence).map(item=><li key={item}>{item}</li>)}</ul></details>
          </article>;
        })}
        <footer>
          <button type="button" disabled={busy} onClick={()=>void history()}>History</button>
          {preview.status==="proposed"&&<>
            <button type="button" disabled={busy} onClick={()=>void change("decline")}>Decline</button>
            <button type="button" disabled={busy} onClick={()=>setEditing(!editing)}>{editing?"Done editing":"Edit values"}</button>
            <button className="plan-approval-primary" type="button" disabled={busy||!chosen.length} onClick={()=>void change("apply")}>Accept {chosen.length===1?"change":`${chosen.length} changes`}</button>
          </>}
          {preview.status==="applied"&&<button className="plan-approval-primary" type="button" disabled={busy} onClick={()=>void change("undo")}>Undo adjustment</button>}
        </footer>
        <small>Only unstarted personal sessions can change. Coach-assigned sessions and reusable templates are not edited.</small>
      </div>:!busy&&(!feed?.proposals.length?<p>No saved previews yet.</p>:<ul className="plan-approval-history">{feed.proposals.map(item=><li key={item.id}><button type="button" onClick={()=>pick(item)}><strong>{item.reason}</strong><span>{new Date(item.createdAt).toLocaleDateString("en-AU")} · {labels[item.status]}</span></button></li>)}</ul>)}
    </dialog>
  </section>;
}

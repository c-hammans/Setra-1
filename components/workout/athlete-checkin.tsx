"use client";

import {useEffect,useMemo,useState} from "react";
import type {AthleteSessionCheckin,SessionFeel} from "@/lib/setra/types";
import {sessionFeelLabel} from "@/lib/data/athlete-checkin-service";

const feels:SessionFeel[]=["easier","expected","harder"];
const clean=(value:AthleteSessionCheckin):AthleteSessionCheckin=>({rpe:value.rpe,feel:value.feel,comment:value.comment?.trim()||undefined,updatedAt:value.updatedAt});
const comparable=(value:AthleteSessionCheckin)=>JSON.stringify({rpe:value.rpe,feel:value.feel,comment:value.comment?.trim()||undefined});

export function AthleteCheckinCard({initial,onSave,disabled=false,compact=false}:{initial?:AthleteSessionCheckin;onSave?:(value:AthleteSessionCheckin)=>Promise<void>;disabled?:boolean;compact?:boolean}){
  const [rpe,setRpe]=useState(initial?.rpe==null?"":String(initial.rpe));
  const [feel,setFeel]=useState<SessionFeel|undefined>(initial?.feel);
  const [comment,setComment]=useState(initial?.comment||"");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{setRpe(initial?.rpe==null?"":String(initial.rpe));setFeel(initial?.feel);setComment(initial?.comment||"");setMessage("")},[initial?.rpe,initial?.feel,initial?.comment]);
  const current=useMemo(()=>clean({rpe:rpe===""?undefined:Number(rpe),feel,comment}),[comment,feel,rpe]);
  const hasFeedback=current.rpe!=null||Boolean(current.feel)||Boolean(current.comment);
  if(!onSave&&!hasFeedback)return null;
  if(!onSave)return <section className="athlete-checkin-card is-readonly"><span>ATHLETE FEEDBACK</span><div className="athlete-checkin-summary">{current.rpe!=null&&<b>Session RPE {current.rpe}/10</b>}{current.feel&&<b>{sessionFeelLabel(current.feel)}</b>}</div>{current.comment&&<p>{current.comment}</p>}</section>;
  async function save(){if(saving||disabled)return;setSaving(true);setMessage("");try{await onSave!(current);setMessage(hasFeedback?"Check-in saved.":"Check-in cleared.")}catch(error){setMessage(error instanceof Error?error.message:"The check-in could not be saved.")}finally{setSaving(false)}}
  return <section className={`athlete-checkin-card${compact?" is-compact":""}`}><header><div><span>OPTIONAL CHECK-IN</span><b>How did that session feel?</b></div><small>Useful for your history and coach</small></header><label className="athlete-rpe-field"><span>SESSION RPE</span><input type="number" inputMode="decimal" min="0" max="10" step="0.5" value={rpe} onChange={event=>setRpe(event.target.value)} placeholder="0–10" /></label><fieldset><legend>SESSION FEEL</legend><div>{feels.map(value=><button type="button" key={value} className={feel===value?"active":""} onClick={()=>setFeel(current=>current===value?undefined:value)}>{sessionFeelLabel(value)}</button>)}</div></fieldset><label className="athlete-comment-field"><span>COMMENT</span><textarea maxLength={1000} value={comment} onChange={event=>setComment(event.target.value)} placeholder="Optional note about how the session felt" /></label><div className="athlete-checkin-actions"><small>{disabled?"Waiting for the completed session to sync.":"Private notes remain separate from this check-in."}</small><button type="button" disabled={disabled||saving||comparable(current)===comparable(initial||{})} onClick={()=>void save()}>{saving?"Saving...":"Save check-in"}</button></div>{message&&<em role="status">{message}</em>}</section>;
}

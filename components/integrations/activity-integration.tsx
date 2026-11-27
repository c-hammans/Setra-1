"use client";

import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {ActivityResult,type ActivityReceipt} from "@/components/integrations/activity-result";
import {fileLimit,sports,sportNames,type MatchRow,type NormalizedActivity} from "@/lib/integrations/activity";
import {addCalendarDays} from "@/lib/setra/week";
import {loadLocalAppearance,loadLocalAppColour,loadLocalTextScale,loadPendingDiaryChanges} from "@/lib/data/local-diary";
import {createSetraTheme,useResolvedAppearance} from "@/lib/setra/appearance";
import type {TrainingActivityType} from "@/lib/setra/types";

const endpoint="/api/integrations/activity";
type Preview={activity:NormalizedActivity;token:string;date:string;today:string};
type Matches={plans:MatchRow[];possibleDuplicates:MatchRow[];manual:MatchRow[]};
type HistoryRow={id:string;format:string;sync_status:string;imported_at:string;session_id:string|null};
const providerNames=["Garmin Connect","Apple Health / Apple Watch","Android Health Connect","COROS","Polar","Suunto","Wahoo","Strava"];
const shortDate=(date:string)=>new Date(date+"T12:00:00").toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short"});
async function request<T>(body?:FormData|object,query=""):Promise<T>{
  const response=await fetch(endpoint+query,{method:body?"POST":"GET",cache:"no-store",headers:body&&!(body instanceof FormData)?{"Content-Type":"application/json"}:undefined,body:body instanceof FormData?body:body?JSON.stringify(body):undefined});
  const json=await response.json().catch(()=>null);
  if(!json||!response.ok)throw new Error(json?.error??"Setra couldn’t complete the import.");
  return json;
}

export function IntegrationsPage(){
  const {user}=useAuth();
  const [theme,setTheme]=useState({colour:"#409ECE",appearance:"system" as ReturnType<typeof loadLocalAppearance>,textScale:1 as ReturnType<typeof loadLocalTextScale>});
  const appearance=useResolvedAppearance(theme.appearance??"system");
  useEffect(()=>{setTheme({colour:loadLocalAppColour(user?.id)??"#409ECE",appearance:loadLocalAppearance(user?.id),textScale:loadLocalTextScale(user?.id)})},[user?.id]);
  return <main className="integrations-page" data-theme={appearance} style={createSetraTheme(theme.colour,appearance,theme.textScale??1)}>
    <nav aria-label="Back"><Link href="/profile">‹ Profile</Link><Link href="/?tab=history">Training history ›</Link></nav>
    <ActivityIntegrationPanel userId={user?.id}/>
  </main>;
}

export function ActivityIntegrationPanel({userId}:{userId?:string}){
  const input=useRef<HTMLInputElement>(null),busyRef=useRef(false);
  const [preview,setPreview]=useState<Preview|null>(null),[sport,setSport]=useState<TrainingActivityType|"">(""),[date,setDate]=useState("");
  const [matching,setMatching]=useState(false),[matches,setMatches]=useState<Matches|null>(null);
  const [mode,setMode]=useState("unplanned"),[target,setTarget]=useState(""),[authorized,setAuthorized]=useState(false),[separate,setSeparate]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[matchError,setMatchError]=useState(""),[message,setMessage]=useState("");
  const [history,setHistory]=useState<HistoryRow[]>([]),[historyError,setHistoryError]=useState(""),[receipt,setReceipt]=useState<ActivityReceipt|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let live=true;
    void request<{history:HistoryRow[]}>().then(result=>{if(live){setHistory(result.history);setHistoryError("")}}).catch(error=>{if(live)setHistoryError(error.message)});
    return()=>{live=false};
  },[revision,userId]);
  useEffect(()=>{
    const query=new URLSearchParams(window.location.search),session=query.get("session"),id=query.get("receipt");
    if(!session&&!id)return;
    let live=true;
    void request<{receipt:ActivityReceipt|null}>(undefined,session?"?session="+encodeURIComponent(session):"?receipt="+encodeURIComponent(id!))
      .then(result=>{if(live)setReceipt(result.receipt)}).catch(()=>{});
    return()=>{live=false};
  },[userId]);
  useEffect(()=>{
    if(!preview||!sport||!date){setMatches(null);return}
    let live=true;
    setMatches(null);setMatching(true);setMatchError("");setMode("unplanned");setTarget("");setSeparate(false);
    void request<Matches>({action:"matches",token:preview.token,date,sport}).then(result=>{if(live)setMatches(result)})
      .catch(error=>{if(live)setMatchError(error.message)}).finally(()=>{if(live)setMatching(false)});
    return()=>{live=false};
  },[preview,date,sport,revision]);
  const reset=()=>{setPreview(null);setSport("");setDate("");setMatches(null);setMatching(false);setAuthorized(false);setMode("unplanned");setTarget("");setSeparate(false);setMatchError("");if(input.current)input.current.value=""};
  async function upload(file?:File){
    if(!file||busyRef.current)return;
    reset();setMessage("");setError("");
    if(file.size>fileLimit){setError("Choose a FIT, TCX or GPX file under 3 MB.");return}
    busyRef.current=true;setBusy(true);
    const data=new FormData();data.append("file",file);data.append("timezone",Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC");
    try{
      const next=await request<Preview|{duplicateId:string}>(data);
      if("duplicateId" in next){reset();setMessage("This activity has already been imported. No duplicate was created.");void openReceipt(next.duplicateId);return}
      setPreview(next);setSport(next.activity.sport??"");setDate(next.date);
    }catch(error){setError((error as Error).message)}
    finally{busyRef.current=false;setBusy(false)}
  }
  async function save(){
    if(!preview||!sport||!date||busyRef.current||!authorized||!matches)return;
    if(loadPendingDiaryChanges(userId).some(change=>["save_endurance_session","delete_endurance_session"].includes(change.kind))){
      setError("Sync your pending endurance changes before importing, so Setra can check for duplicates.");return;
    }
    busyRef.current=true;setBusy(true);setError("");setMessage("");
    try{
      const result=await request<{id:string;status:string}>({action:"save",token:preview.token,sport,date,authorizedFile:authorized,allowSeparate:separate,
        plan:mode==="plan"?target:null,manual:mode==="manual"?target:null});
      reset();setRevision(value=>value+1);
      setMessage(result.status==="duplicate"?"This activity has already been imported. No duplicate was created.":result.status==="reconciled"?"File metrics attached to your existing activity. Its original results were not changed.":"Activity saved to Training history.");
      if(result.id)void openReceipt(result.id);
    }catch(error){setError((error as Error).message);setRevision(value=>value+1)}
    finally{busyRef.current=false;setBusy(false)}
  }
  async function openReceipt(id:string){
    try{const result=await request<{receipt:ActivityReceipt}>(undefined,"?receipt="+encodeURIComponent(id));setReceipt(result.receipt)}
    catch(error){setHistoryError((error as Error).message)}
  }
  const rows=mode==="plan"?matches?.plans:matches?.manual;
  const mustConfirm=Boolean(matches?.possibleDuplicates.length&&mode!=="manual");
  return <>
    <header><span>SETTINGS</span><h1>Integrations</h1><p>Bring completed activity files into your Setra training history.</p></header>
    <section className="integration-panel" id="activity-import">
      <h2>Import completed activity</h2>
      <p>FIT, TCX and timestamped GPX, up to 3 MB. Review before saving. Setra doesn’t keep the raw file or GPS points.</p>
      <label className="activity-file-label">Activity file<input ref={input} type="file" accept=".fit,.tcx,.gpx" disabled={busy} onChange={e=>void upload(e.target.files?.[0])}/></label>
      {preview&&<div className="activity-review">
        <h3>Review activity</h3>
        <div className="activity-review-fields">
          <label>Sport<select value={sport} onChange={e=>setSport(e.target.value as TrainingActivityType)} disabled={busy}><option value="">Choose sport</option>{sports.map(key=><option key={key} value={key}>{sportNames[key]}</option>)}</select></label>
          <label>Activity date<input type="date" value={date} min={addCalendarDays(preview.date,-1)} max={preview.today<addCalendarDays(preview.date,1)?preview.today:addCalendarDays(preview.date,1)} disabled={busy} onChange={e=>setDate(e.target.value)}/></label>
        </div>
        <ActivityResult activity={{...preview.activity,sport:sport||null}}/>
        {matching&&<p role="status">Checking planned and completed activities…</p>}
        {matchError&&<p role="alert">{matchError}</p>}
        {matches&&<>
          {matches.possibleDuplicates.length>0&&<div className="activity-duplicate"><strong>Possible duplicate</strong><p>Review {matches.possibleDuplicates.map(row=>row.title).join(", ")} before adding a second record.</p></div>}
          <label>Save as<select value={mode} disabled={busy} onChange={event=>{setMode(event.target.value);setTarget("");setSeparate(false)}}>
            <option value="unplanned">Unplanned completed activity</option>
            {matches.plans.length>0&&<option value="plan">Complete a planned session</option>}
            {matches.manual.length>0&&<option value="manual">Reconcile with an existing activity</option>}
          </select></label>
          {mode!=="unplanned"&&<label>{mode==="plan"?"Confirm planned session":"Choose your existing activity"}
            <select value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">Select one session</option>
              {rows?.map(row=><option value={row.id} key={row.id}>{row.title} · {shortDate(row.date)}{row.distance? ` · ${Number((row.distance/1000).toFixed(2))} km`:""}{row.duration?` · ${Math.round(row.duration/60)} min`:""}</option>)}
            </select>
          </label>}
          {mode==="manual"&&<small>Attaches the file’s recorded metrics alongside the current entry. It does not replace manually logged values, notes or planned links.</small>}
          {mustConfirm&&<label className="activity-check"><input type="checkbox" checked={separate} disabled={busy} onChange={e=>setSeparate(e.target.checked)}/> This is a separate activity.</label>}
        </>}
        <label className="activity-check"><input type="checkbox" checked={authorized} disabled={busy} onChange={e=>setAuthorized(e.target.checked)}/> I’m allowed to use this file in Setra. Saved activity data works like other training data, including permitted coaching, sharing and Adaptive uses.</label>
        <div className="activity-actions"><button type="button" disabled={busy} onClick={()=>{reset();setError("")}}>Cancel</button><button type="button" className="activity-primary" disabled={busy||matching||!matches||!authorized||(!target&&mode!=="unplanned")||(mustConfirm&&!separate)} onClick={()=>void save()}>{mode==="manual"?"Attach file results":"Save completed activity"}</button></div>
      </div>}
      {busy&&<p role="status">Working on your activity…</p>}
      {error&&<p className="activity-error" role="alert">{error}</p>}
      {message&&<p className="activity-status" role="status">{message}</p>}
    </section>
    <section className="integration-panel" id="activity-record"><h2>Import history</h2>
      {historyError&&<p role="status">{historyError}</p>}
      {!history.length&&!historyError?<p>No recent imports.</p>:<ul className="activity-history">
        {history.map(item=><li key={item.id}><button type="button" onClick={()=>void openReceipt(item.id)}><b>{item.format.toUpperCase()} · {item.sync_status==="reconciled"?"Reconciled":"Imported"}</b><span>{new Date(item.imported_at).toLocaleDateString("en-AU")}{!item.session_id?" · Activity removed":""}</span></button></li>)}
      </ul>}
      {receipt&&<section className="activity-receipt"><div><h3>Original file results</h3><button type="button" onClick={()=>setReceipt(null)}>Close details</button></div><ActivityResult activity={receipt.recorded_result}/></section>}
    </section>
    <section className="integration-panel"><h2>Device connections</h2><p>There are no connected providers. File imports don’t connect your account to a device service.</p><ul className="activity-providers">{providerNames.map(name=><li key={name}><b>{name}</b><span>Not available</span></li>)}</ul></section>
  </>;
}

"use client";

import {useEffect,useState} from "react";
import {sportNames,type ActivityMetrics,type NormalizedActivity} from "@/lib/integrations/activity";

export type ActivityReceipt={id:string;format:string;sync_status:string;imported_at:string;recorded_result:NormalizedActivity&{date?:string}};
export const activityClock=(value:number)=>{
  const seconds=Math.round(value),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds/60)%60;
  return `${hours?hours+"h ":""}${minutes}m ${seconds%60}s`;
};
const num=(n:number,digits=1)=>new Intl.NumberFormat("en-AU",{maximumFractionDigits:digits}).format(n);
const datum=(value:number|undefined,format:(n:number)=>string)=>value===undefined?undefined:format(value);
const detailDate=(value:string)=>new Date(value).toLocaleString("en-AU",{dateStyle:"medium",timeStyle:"short"});
const metrics=(data:ActivityMetrics,sport:NormalizedActivity["sport"])=>{
  const duration=data.activeSeconds??data.elapsedSeconds;
  const speed=data.speedMps??(duration&&data.distanceMetres?data.distanceMetres/duration:undefined);
  const pace=speed&&["run","swim","row","walk_hike"].includes(sport??"")?datum(speed,n=>`${activityClock((sport==="swim"?100:sport==="row"?500:1000)/n)} / ${sport==="swim"?"100 m":sport==="row"?"500 m":"km"}`):undefined;
  return [
    ["Active / timer time",datum(data.activeSeconds,activityClock)],["Elapsed time",datum(data.elapsedSeconds,activityClock)],
    ["Distance",datum(data.distanceMetres,n=>sport==="swim"?num(n,0)+" m":num(n/1000,2)+" km")],
    [pace?"Pace":"Average speed",pace??datum(speed,n=>num(n*3.6)+" km/h")],
    ["Elevation gain",datum(data.ascentMetres,n=>num(n,0)+" m")],["Average heart rate",datum(data.heartRate,n=>num(n,0)+" bpm")],
    ["Average power",datum(data.powerWatts,n=>num(n,0)+" W")],["Average cadence",datum(data.cadence,n=>num(n,0)+" /min")],
    ["Swim lengths",datum(data.swimLengths,n=>num(n,0))],["Pool length",datum(data.poolLengthMetres,n=>num(n)+" m")]
  ].filter((entry):entry is [string,string]=>entry[1]!==undefined);
};

export function ActivityResult({activity}:{activity:NormalizedActivity}){
  return <div className="activity-result">
    <p>{activity.format.toUpperCase()} · {activity.sport?sportNames[activity.sport]:"Sport not identified"}</p>
    <p><strong>Started:</strong> {detailDate(activity.start)}{activity.finish&&<> · <strong>Finished:</strong> {detailDate(activity.finish)}</>}</p>
    <dl>{metrics(activity.metrics,activity.sport).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    {activity.notes.map(note=><p key={note}>{note}</p>)}
    {activity.laps.length>0&&<details><summary>Recorded laps ({activity.laps.length})</summary>
      <p>These are actual laps from the file. They aren’t matched to planned intervals.</p>
      <ol>{activity.laps.map((lap,index)=><li key={index}><b>Lap {index+1}</b><span>{metrics(lap,activity.sport).map(([,value])=>value).join(" · ")||"No recorded metrics"}</span></li>)}</ol>
    </details>}
  </div>;
}

export function ImportedActivityDetails({sessionId}:{sessionId:string}){
  const [receipt,setReceipt]=useState<ActivityReceipt|null>(null);
  const [opened,setOpened]=useState(false),[error,setError]=useState(false);
  useEffect(()=>{
    if(!opened)return;
    const controller=new AbortController();
    fetch("/api/integrations/activity?session="+encodeURIComponent(sessionId),{signal:controller.signal,cache:"no-store"})
      .then(async res=>{if(!res.ok)throw new Error();return res.json()}).then(data=>setReceipt(data.receipt)).catch(()=>{if(!controller.signal.aborted)setError(true)});
    return ()=>controller.abort();
  },[opened,sessionId]);
  return <details className="imported-activity-details" onToggle={event=>{if(event.currentTarget.open)setOpened(true)}}>
    <summary>Original file metrics and laps</summary>
    {receipt?<ActivityResult activity={receipt.recorded_result}/>:<p>{error?"Import details aren’t available right now.":"Loading original activity data…"}</p>}
  </details>;
}

"use client";

import {useMemo} from "react";
import {activityLabel} from "@/components/endurance/endurance-session-sheet";
import type {TrainingActivityType} from "@/lib/setra/types";
import {dayIndexInUserWeek,parseLocalDate,weekDateKeys,type WeekdayIndex} from "@/lib/setra/week";

export type WeeklyPreviewItem={
  id:string;
  sourceId:string;
  completedId?:string;
  date:string;
  title:string;
  descriptor:string;
  modality:"strength"|"endurance";
  activityType?:TrainingActivityType;
  status:"planned"|"completed"|"skipped";
  startTime?:string;
};

type Props={items:WeeklyPreviewItem[];weekStartsOn:WeekdayIndex;today:string;onClose:()=>void;onSelect:(item:WeeklyPreviewItem)=>void;onPlan:()=>void};
const dayHeading=(date:string)=>new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"numeric"}).format(parseLocalDate(date)).toUpperCase();
const fullDay=(date:string)=>new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"short"}).format(parseLocalDate(date));
const rangeLabel=(dates:string[])=>{const first=parseLocalDate(dates[0]);const last=parseLocalDate(dates[6]);const start=new Intl.DateTimeFormat("en-AU",{day:"numeric",month:first.getMonth()===last.getMonth()?undefined:"short"}).format(first);const end=new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"long"}).format(last);return `${start}–${end}`};

export function WeeklyPreview({items,weekStartsOn,today,onClose,onSelect,onPlan}:Props){
  const dates=weekDateKeys(today,weekStartsOn);
  const ordered=useMemo(()=>[...items].sort((a,b)=>a.date.localeCompare(b.date)||(a.startTime||"99:99").localeCompare(b.startTime||"99:99")||a.title.localeCompare(b.title)),[items]);
  const completed=ordered.filter(item=>item.status==="completed").length;
  const skipped=ordered.filter(item=>item.status==="skipped").length;
  const remaining=ordered.length-completed-skipped;
  const next=ordered.find(item=>item.status==="planned"&&(item.date>today||(item.date===today&&(!item.startTime||item.startTime>=new Date().toTimeString().slice(0,5)))))||ordered.find(item=>item.status==="planned");
  const groups=dates.map(date=>({date,items:ordered.filter(item=>item.date===date)})).filter(group=>group.items.length>0);
  const progress=ordered.length?completed/ordered.length:0;
  const summary=ordered.length===0?"No sessions planned":remaining===0?(skipped?`${completed} complete · ${skipped} skipped`:"Week complete"):`${remaining} ${remaining===1?"session":"sessions"} remaining${next?` · Next: ${next.title}`:""}`;

  return <div className="weekly-preview-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="weekly-preview-modal" role="dialog" aria-modal="true" aria-labelledby="weekly-preview-title">
      <header><div><small>WEEKLY PREVIEW</small><h2 id="weekly-preview-title">Your week</h2><p>{rangeLabel(dates)}</p></div><button onClick={onClose} aria-label="Close weekly preview">×</button></header>
      <div className="weekly-preview-progress">
        <div><small>TODAY</small><b>{fullDay(today)}</b><span>Day {dayIndexInUserWeek(today,weekStartsOn)+1} of 7</span></div>
        <div><small>TRAINING</small><b>{completed} of {ordered.length} sessions complete</b>{skipped>0&&<span>{skipped} skipped</span>}</div>
        <i aria-hidden="true"><span style={{width:`${progress*100}%`}}/></i>
      </div>
      <div className="weekly-preview-scroll">
        {groups.length?groups.map(group=><section className={group.date===today?"weekly-day is-today":"weekly-day"} key={group.date}>
          <h3>{dayHeading(group.date)}{group.date===today&&<em>TODAY</em>}</h3>
          <div>{group.items.map(item=><button key={item.id} className={`weekly-session is-${item.status}`} onClick={()=>onSelect(item)}>
            <i aria-hidden="true">{item.status==="completed"?"✓":item.status==="skipped"?"—":""}</i>
            <span><b>{item.title}</b><small>{item.status==="skipped"?"Skipped":item.descriptor||item.activityType&&activityLabel(item.activityType)||"Session"}</small></span><em>›</em>
          </button>)}</div>
        </section>):<div className="weekly-preview-empty"><b>Nothing planned yet</b><p>Your week is open. Add a session when you&apos;re ready.</p><button onClick={onPlan}>Plan session</button></div>}
      </div>
      {ordered.length>0&&<footer><span>{summary}</span></footer>}
    </section>
  </div>;
}

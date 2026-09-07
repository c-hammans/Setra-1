"use client";

import {activityLabel,activityShort} from "@/components/endurance/endurance-session-sheet";
import {calculateStructuredTotals,childrenOf,formatStepTime,formatTrainingStep,stepDistanceUsesMetres} from "@/lib/setra/endurance-steps";
import type {EnduranceSession,TrainingSessionBlock} from "@/lib/setra/types";

type Props={session:EnduranceSession;onClose:()=>void;onEdit:()=>void;onComplete?:()=>void;onDelete:()=>void};
const formatDate=(value:string)=>new Intl.DateTimeFormat("en-AU",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`));
const formatDistance=(metres:number,session:EnduranceSession)=>stepDistanceUsesMetres(session.activityType)?`${Number(metres.toFixed(0))} m`:`${Number((metres/1000).toFixed(2))} km`;

function StructureRows({session,parentId,depth=0}:{session:EnduranceSession;parentId?:string;depth?:number}){
  return <>{childrenOf(session.blocks,parentId).map((block:TrainingSessionBlock)=>block.type==="repeat_group"?<section className="prescription-repeat" style={{"--view-depth":depth} as React.CSSProperties} key={block.id}><header><span>↻</span><div><b>{block.title||"Repeat"}</b>{block.instructions&&<small>{block.instructions}</small>}</div><strong>×{block.repetitions||1}</strong></header><div><StructureRows session={session} parentId={block.id} depth={depth+1}/></div></section>:<div className="prescription-step" style={{"--view-depth":depth} as React.CSSProperties} key={block.id}><i className={`step-role role-${block.type}`}/><span><b>{block.title||block.type.replace("_"," ")}</b>{block.instructions&&<small>{block.instructions}</small>}</span><strong>{formatTrainingStep(block,session.activityType)}</strong></div>)}</>;
}

export function EnduranceStructureView({session}:{session:EnduranceSession}){return session.blocks.length?<div className="endurance-prescription"><StructureRows session={session}/></div>:<p className="simple-session-prescription">Simple session — follow the planned duration or distance above.</p>}

export function EnduranceWorkoutView({session,onClose,onEdit,onComplete,onDelete}:Props){
  const totals=calculateStructuredTotals(session.blocks);const plannedDuration=session.plannedDurationMinutes||(totals.durationSeconds?totals.durationSeconds/60:undefined);const plannedDistanceMetres=session.plannedDistanceKm!=null?session.plannedDistanceKm*1000:totals.distanceMetres||undefined;
  return <div className="overlay high-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="sheet endurance-workout-view" onMouseDown={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title compact-endurance-title"><div><span>{activityLabel(session.activityType).toUpperCase()} · {session.status.toUpperCase()}</span><h2>{session.title}</h2></div><button onClick={onClose} aria-label="Close">×</button></div>
    <div className="workout-view-meta"><span className="activity-pill">{activityShort(session.activityType)}</span><p><b>{formatDate(session.date)}{session.plannedStartTime?` · ${session.plannedStartTime}`:""}</b><small>{[session.category?.replace("_"," "),session.environment&&session.environment!=="unspecified"?session.environment.replace("_"," "):""].filter(Boolean).join(" · ")}</small></p></div>
    <div className="workout-view-totals">{plannedDistanceMetres!=null&&<p><span>PLANNED DISTANCE</span><b>{formatDistance(plannedDistanceMetres,session)}</b></p>}{plannedDuration!=null&&<p><span>PLANNED TIME</span><b>{formatStepTime(Math.round(plannedDuration*60))}</b></p>}{session.targetRpe!=null&&<p><span>TARGET RPE</span><b>{session.targetRpe}/10</b></p>}</div>
    <section className="workout-view-structure"><header><span>WORKOUT</span>{session.blocks.length>0&&<small>{session.blocks.length} structured items</small>}</header><EnduranceStructureView session={session}/></section>
    {session.notes&&<section className="workout-view-notes"><span>NOTES</span><p>{session.notes}</p></section>}
    {session.status==="planned"&&<div className="future-device-slot"><span>DEVICE SYNC</span><small>Watch export and activity matching can connect here later.</small></div>}
    <div className="endurance-detail-actions">{session.status==="planned"&&onComplete&&<button className="primary-button" onClick={onComplete}>Complete session <span>→</span></button>}<button onClick={onEdit}>Edit {session.status==="completed"?"activity":"workout"}</button><button className="delete-workout-button" onClick={onDelete}>Delete session</button></div>
  </section></div>;
}

"use client";

import {useState} from "react";
import {
  displayStepDistance,
  enduranceTargetOptions,
  formatStepClock,
  formatTrainingStep,
  parseStepClock,
  stepDistanceUsesMetres,
  stepTargetSuffix,
  stepTargetUnit,
} from "@/lib/setra/endurance-steps";
import type {
  TrainingActivityType,
  TrainingBlockType,
  TrainingCompletionType,
  TrainingSessionBlock,
  TrainingTargetMetric,
} from "@/lib/setra/types";

type Props={
  block:TrainingSessionBlock;
  label:string;
  activityType:TrainingActivityType;
  expanded:boolean;
  grouped?:boolean;
  canMoveUp:boolean;
  canMoveDown:boolean;
  onToggle:()=>void;
  onUpdate:(patch:Partial<TrainingSessionBlock>)=>void;
  onMove:(direction:-1|1)=>void;
  onRemove:()=>void;
  onUngroup?:()=>void;
};

const num=(value:string)=>value===""?undefined:Number(value);

export function EnduranceStepCard({block,label,activityType,expanded,grouped=false,canMoveUp,canMoveDown,onToggle,onUpdate,onMove,onRemove,onUngroup}:Props){
  const [paceDraft,setPaceDraft]=useState<{min?:string;max?:string}>({});
  const recoveryType=block.recoveryDurationSeconds!=null?"time":block.recoveryDistanceMetres!=null?"distance":"none";
  const paceTarget=block.targetMetric==="pace";
  return <article className={`endurance-step-card ${expanded?"expanded":"collapsed"}${grouped?" grouped-step":""}`}>
    <header>
      <button type="button" className="step-toggle" onClick={onToggle} aria-expanded={expanded}>
        <span>{label}</span><b>{block.title||"Untitled step"}</b><small>{formatTrainingStep(block,activityType)}</small><em>{expanded?"⌃":"⌄"}</em>
      </button>
      <div>
        <button type="button" disabled={!canMoveUp} onClick={()=>onMove(-1)} aria-label={`Move ${label} up`}>↑</button>
        <button type="button" disabled={!canMoveDown} onClick={()=>onMove(1)} aria-label={`Move ${label} down`}>↓</button>
        <button type="button" className="remove-step" onClick={onRemove} aria-label={`Remove ${label}`}>×</button>
      </div>
    </header>
    {expanded&&<>
      {grouped&&<div className="group-membership"><span>PART OF REPEAT GROUP</span>{onUngroup&&<button type="button" onClick={onUngroup}>Move out</button>}</div>}
      <div className="step-field-grid">
        <label>STEP TYPE<select value={block.type} onChange={event=>onUpdate({type:event.target.value as TrainingBlockType})}><option value="warmup">Warm-up</option><option value="main">Steady work</option><option value="interval">Interval / work</option><option value="recovery">Recovery</option><option value="cooldown">Cool-down</option><option value="custom">Custom</option></select></label>
        <label>NAME<input maxLength={120} value={block.title} onChange={event=>onUpdate({title:event.target.value})} placeholder="e.g. 800 m repeat"/></label>
      </div>
      <div className="step-field-grid">
        <label>STEP ENDS AFTER<select value={block.completionType||"open"} onChange={event=>onUpdate({completionType:event.target.value as TrainingCompletionType,durationSeconds:undefined,distanceMetres:undefined})}><option value="time">Time</option><option value="distance">Distance</option><option value="open">Open</option><option value="lap_button">Lap button</option></select></label>
        {block.completionType==="time"?<label>DURATION (MIN)<input inputMode="decimal" type="number" min="0" step="0.1" value={block.durationSeconds==null?"":block.durationSeconds/60} onChange={event=>onUpdate({durationSeconds:num(event.target.value)==null?undefined:Math.round(Number(event.target.value)*60)})}/></label>:block.completionType==="distance"?<label>DISTANCE ({stepDistanceUsesMetres(activityType)?"M":"KM"})<input inputMode="decimal" type="number" min="0" step={stepDistanceUsesMetres(activityType)?"1":"0.01"} value={displayStepDistance(block.distanceMetres,activityType)} onChange={event=>onUpdate({distanceMetres:num(event.target.value)==null?undefined:Number(event.target.value)*(stepDistanceUsesMetres(activityType)?1:1000)})}/></label>:<label>REPEATS<input inputMode="numeric" type="number" min="1" max="1000" value={block.repetitions||1} onChange={event=>onUpdate({repetitions:Math.max(1,Number(event.target.value)||1)})}/></label>}
      </div>
      {block.completionType!=="open"&&block.completionType!=="lap_button"&&<label className="step-full-field">REPEATS<input inputMode="numeric" type="number" min="1" max="1000" value={block.repetitions||1} onChange={event=>onUpdate({repetitions:Math.max(1,Number(event.target.value)||1)})}/></label>}
      <label className="step-full-field">TARGET<select value={block.targetMetric||""} onChange={event=>{const metric=event.target.value as TrainingTargetMetric|"";onUpdate({targetMetric:metric||undefined,targetUnit:metric?stepTargetUnit(activityType,metric):undefined,targetMinValue:undefined,targetMaxValue:undefined,intensityTarget:undefined})}}><option value="">No target</option>{enduranceTargetOptions(activityType).map(([value,text])=><option value={value} key={value}>{text}</option>)}</select></label>
      {block.targetMetric==="effort"?<label className="step-full-field">EFFORT<input maxLength={160} value={block.intensityTarget||""} onChange={event=>onUpdate({intensityTarget:event.target.value})} placeholder="e.g. Easy, threshold, 10K effort"/></label>:block.targetMetric&&<div className="step-field-grid">
        <label>{paceTarget?"FASTEST":"MINIMUM"}<input inputMode={paceTarget?"text":"decimal"} type={paceTarget?"text":"number"} min={paceTarget?undefined:"0"} value={paceTarget?(paceDraft.min??formatStepClock(block.targetMinValue)):block.targetMinValue??""} onChange={event=>{if(paceTarget)setPaceDraft(current=>({...current,min:event.target.value}));onUpdate({targetMinValue:paceTarget?parseStepClock(event.target.value):num(event.target.value)})}} placeholder={paceTarget?"5:00":""}/></label>
        <label>{paceTarget?"SLOWEST":"MAXIMUM"}<span className="target-input-with-unit"><input inputMode={paceTarget?"text":"decimal"} type={paceTarget?"text":"number"} min={paceTarget?undefined:"0"} value={paceTarget?(paceDraft.max??formatStepClock(block.targetMaxValue)):block.targetMaxValue??""} onChange={event=>{if(paceTarget)setPaceDraft(current=>({...current,max:event.target.value}));onUpdate({targetMaxValue:paceTarget?parseStepClock(event.target.value):num(event.target.value)})}} placeholder={paceTarget?"5:30":""}/><small>{stepTargetSuffix(block.targetUnit)}</small></span></label>
      </div>}
      {(block.repetitions||1)>1&&<div className="step-recovery">
        <label>RECOVERY<select value={recoveryType} onChange={event=>onUpdate({recoveryDurationSeconds:event.target.value==="time"?60:undefined,recoveryDistanceMetres:event.target.value==="distance"?(stepDistanceUsesMetres(activityType)?100:1000):undefined})}><option value="none">No recovery</option><option value="time">Time</option><option value="distance">Distance</option></select></label>
        {recoveryType==="time"&&<label>RECOVERY (MIN)<input inputMode="decimal" type="number" min="0" step="0.1" value={(block.recoveryDurationSeconds||0)/60} onChange={event=>onUpdate({recoveryDurationSeconds:Math.round(Number(event.target.value)*60)})}/></label>}
        {recoveryType==="distance"&&<label>RECOVERY ({stepDistanceUsesMetres(activityType)?"M":"KM"})<input inputMode="decimal" type="number" min="0" step={stepDistanceUsesMetres(activityType)?"1":"0.01"} value={displayStepDistance(block.recoveryDistanceMetres,activityType)} onChange={event=>onUpdate({recoveryDistanceMetres:Number(event.target.value)*(stepDistanceUsesMetres(activityType)?1:1000)})}/></label>}
      </div>}
      <label className="step-full-field">ADDITIONAL INSTRUCTIONS<textarea value={block.instructions} onChange={event=>onUpdate({instructions:event.target.value})} placeholder="Optional technique, terrain or equipment notes"/></label>
      <output className="step-summary">{formatTrainingStep(block,activityType)}</output>
    </>}
  </article>;
}

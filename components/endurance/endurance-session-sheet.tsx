"use client";

import {useMemo,useState} from "react";
import {EnduranceStepCard} from "@/components/endurance/endurance-step-card";
import {formatStepClock,formatTrainingStep} from "@/lib/setra/endurance-steps";
import type {EnduranceSession,TrainingActivityType,TrainingSessionBlock} from "@/lib/setra/types";

export const activityOptions:[TrainingActivityType,string,string][]=[
  ["run","Run","RUN"],["bike","Bike","BIKE"],["swim","Swim","SWIM"],["row","Row","ROW"],
  ["walk_hike","Walk / hike","WALK"],["elliptical","Elliptical","ELL"],["cross_training","Cross-training","XTR"],["custom","Other / custom","OTHER"],
];
export const activityLabel=(type:TrainingActivityType)=>activityOptions.find(item=>item[0]===type)?.[1]||"Activity";
export const activityShort=(type:TrainingActivityType)=>activityOptions.find(item=>item[0]===type)?.[2]||"ACT";

type Props={mode:"plan"|"log";date:string;initial?:EnduranceSession|null;onClose:()=>void;onSave:(session:EnduranceSession)=>void};
const num=(value:string)=>value===""?undefined:Number(value);
const makeStep=(title="Work",parentId?:string):TrainingSessionBlock=>({id:`block-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,parentId,type:"interval",title,instructions:"",repetitions:1,completionType:"time",durationSeconds:300});

export function EnduranceSessionSheet({mode,date,initial,onClose,onSave}:Props){
  const completed=mode==="log";
  const [activityType,setActivityType]=useState<TrainingActivityType>(initial?.activityType||"run");
  const [title,setTitle]=useState(initial?.title||activityLabel(initial?.activityType||"run"));
  const [sessionDate,setSessionDate]=useState(initial?.date||date);
  const [startTime,setStartTime]=useState(initial?.startedAt||initial?.plannedStartTime||"");
  const [duration,setDuration]=useState(String(completed?initial?.durationMinutes??initial?.plannedDurationMinutes??"":initial?.plannedDurationMinutes??""));
  const [distance,setDistance]=useState(String(completed?initial?.distanceKm??initial?.plannedDistanceKm??"":initial?.plannedDistanceKm??""));
  const [rpe,setRpe]=useState(String(completed?initial?.rpe??initial?.targetRpe??"":initial?.targetRpe??""));
  const [heartRate,setHeartRate]=useState(String(initial?.averageHeartRate??""));
  const [elevation,setElevation]=useState(String(initial?.elevationGainMetres??""));
  const [notes,setNotes]=useState(initial?.notes||"");
  const [blocks,setBlocks]=useState<TrainingSessionBlock[]>(()=>structuredClone(initial?.blocks||[]));
  const [expandedSteps,setExpandedSteps]=useState<Set<string>>(new Set());
  const durationNumber=num(duration);const distanceNumber=num(distance);
  const topLevelBlocks=blocks.filter(block=>!block.parentId);
  const childrenOf=(groupId:string,source=blocks)=>source.filter(block=>block.parentId===groupId);
  const flattenUnits=(top:TrainingSessionBlock[],source=blocks)=>top.flatMap(block=>block.type==="repeat_group"?[block,...childrenOf(block.id,source)]:[block]);

  const derived=useMemo(()=>{
    if(!completed||!durationNumber||!distanceNumber)return "";
    if(activityType==="bike"||activityType==="elliptical"||activityType==="cross_training")return `${(distanceNumber/(durationNumber/60)).toFixed(1)} km/h average`;
    const pace=durationNumber*60/distanceNumber;if(activityType==="row")return `${formatStepClock(pace/2)} /500 m average`;if(activityType==="swim")return `${formatStepClock(pace/10)} /100 m average`;return `${formatStepClock(pace)} /km average`;
  },[activityType,completed,distanceNumber,durationNumber]);

  const toggleExpanded=(id:string)=>setExpandedSteps(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next});
  const updateBlock=(id:string,patch:Partial<TrainingSessionBlock>)=>setBlocks(current=>current.map(block=>block.id===id?{...block,...patch}:block));
  const removeBlock=(id:string)=>setBlocks(current=>current.filter(block=>block.id!==id&&block.parentId!==id));
  const moveTopLevel=(id:string,direction:-1|1)=>setBlocks(current=>{const top=current.filter(block=>!block.parentId);const index=top.findIndex(block=>block.id===id);const target=index+direction;if(index<0||target<0||target>=top.length)return current;[top[index],top[target]]=[top[target],top[index]];return flattenUnits(top,current)});
  const moveChild=(groupId:string,id:string,direction:-1|1)=>setBlocks(current=>{const children=childrenOf(groupId,current);const index=children.findIndex(block=>block.id===id);const target=index+direction;if(index<0||target<0||target>=children.length)return current;[children[index],children[target]]=[children[target],children[index]];const top=current.filter(block=>!block.parentId);return top.flatMap(block=>block.id===groupId?[block,...children]:block.type==="repeat_group"?[block,...childrenOf(block.id,current)]:[block])});
  const addBlock=()=>{const block=makeStep();setBlocks(current=>[...current,block]);setExpandedSteps(current=>new Set(current).add(block.id))};
  const addGroupChild=(groupId:string)=>{const block=makeStep("Work",groupId);setBlocks(current=>{const lastIndex=current.reduce((found,item,index)=>item.id===groupId||item.parentId===groupId?index:found,-1);const next=[...current];next.splice(lastIndex+1,0,block);return next});setExpandedSteps(current=>new Set(current).add(block.id))};
  const addGroup=()=>{const stamp=Date.now();const group:TrainingSessionBlock={id:`group-${stamp}`,type:"repeat_group",title:"Repeat group",instructions:"",repetitions:3,completionType:"open"};const work={...makeStep("Work",group.id),id:`block-${stamp}-work`};const recovery={...makeStep("Recovery",group.id),id:`block-${stamp}-recovery`,type:"recovery" as const,durationSeconds:60};setBlocks(current=>[...current,group,work,recovery]);setExpandedSteps(current=>new Set(current).add(group.id))};
  const ungroupChild=(groupId:string,id:string)=>setBlocks(current=>{const child=current.find(block=>block.id===id);if(!child)return current;const without=current.filter(block=>block.id!==id);const lastGroupIndex=without.reduce((found,item,index)=>item.id===groupId||item.parentId===groupId?index:found,-1);without.splice(lastGroupIndex+1,0,{...child,parentId:undefined});return without});

  function submit(event:React.FormEvent){
    event.preventDefault();const pace=completed&&durationNumber&&distanceNumber?durationNumber*60/distanceNumber:undefined;
    const normalizedBlocks=blocks.map(block=>block.targetMinValue!=null&&block.targetMaxValue!=null&&block.targetMinValue>block.targetMaxValue?{...block,targetMinValue:block.targetMaxValue,targetMaxValue:block.targetMinValue}:block);
    onSave({id:initial?.id||`endurance-${Date.now()}`,activityType,status:completed?"completed":"planned",title:title.trim()||activityLabel(activityType),date:sessionDate,plannedStartTime:completed?initial?.plannedStartTime:startTime||undefined,plannedDurationMinutes:completed?initial?.plannedDurationMinutes:durationNumber,plannedDistanceKm:completed?initial?.plannedDistanceKm:distanceNumber,targetRpe:completed?initial?.targetRpe:num(rpe),startedAt:completed?startTime||undefined:initial?.startedAt,durationMinutes:completed?durationNumber:initial?.durationMinutes,distanceKm:completed?distanceNumber:initial?.distanceKm,averagePaceSecondsPerKm:completed&&pace&&!["bike","elliptical","cross_training","row"].includes(activityType)?pace:undefined,averageSpeedKph:completed&&durationNumber&&distanceNumber&&["bike","elliptical","cross_training"].includes(activityType)?distanceNumber/(durationNumber/60):undefined,averageSplitSecondsPer500m:completed&&pace&&activityType==="row"?pace/2:undefined,rpe:completed?num(rpe):initial?.rpe,averageHeartRate:completed?num(heartRate):initial?.averageHeartRate,elevationGainMetres:completed?num(elevation):initial?.elevationGainMetres,notes,blocks:normalizedBlocks,source:initial?.source||"manual",completedAt:completed?initial?.completedAt||new Date().toISOString():undefined});
  }

  return <div className="overlay high-overlay endurance-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="sheet endurance-sheet" onMouseDown={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{completed?"LOG ACTIVITY":"PLAN SESSION"}</span><h2>{completed?initial?.status==="planned"?"Complete your session":"Add to your diary":"What are you training?"}</h2></div><button onClick={onClose} aria-label="Close">×</button></div><form onSubmit={submit}>
    <label className="endurance-field">ACTIVITY TYPE<select value={activityType} onChange={event=>setActivityType(event.target.value as TrainingActivityType)}>{activityOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    <label className="endurance-field">SESSION TITLE<input required maxLength={120} value={title} onChange={event=>setTitle(event.target.value)} placeholder={`${activityLabel(activityType)} session`}/></label>
    <div className="endurance-field-grid"><label className="endurance-field">DATE<input required type="date" value={sessionDate} onChange={event=>setSessionDate(event.target.value)}/></label><label className="endurance-field">{completed?"START TIME":"PLANNED TIME"}<input type="time" value={startTime} onChange={event=>setStartTime(event.target.value)}/></label></div>
    <div className="endurance-field-grid"><label className="endurance-field">{completed?"DURATION (MIN)":"PLANNED DURATION (MIN)"}<input inputMode="decimal" type="number" min="0" step="0.1" value={duration} onChange={event=>setDuration(event.target.value)}/></label><label className="endurance-field">{completed?"DISTANCE (KM)":"PLANNED DISTANCE (KM)"}<input inputMode="decimal" type="number" min="0" step="0.01" value={distance} onChange={event=>setDistance(event.target.value)}/></label></div>
    {derived&&<output className="endurance-derived">{derived}</output>}
    <label className="endurance-field">{completed?"SESSION RPE":"TARGET RPE"}<input inputMode="decimal" type="number" min="0" max="10" step="0.5" value={rpe} onChange={event=>setRpe(event.target.value)} placeholder="Optional · 0–10"/></label>
    {completed&&<div className="endurance-field-grid"><label className="endurance-field">AVG HEART RATE<input inputMode="numeric" type="number" min="20" max="260" value={heartRate} onChange={event=>setHeartRate(event.target.value)} placeholder="bpm"/></label><label className="endurance-field">ELEVATION (M)<input inputMode="decimal" type="number" min="0" step="1" value={elevation} onChange={event=>setElevation(event.target.value)} placeholder="Optional"/></label></div>}
    <fieldset className="endurance-structure step-builder"><legend>SESSION STEPS <small>OPTIONAL</small></legend>
      {topLevelBlocks.length===0&&<p className="step-builder-empty">Add individual steps or group several steps into a repeat block.</p>}
      {topLevelBlocks.map((block,index)=>block.type==="repeat_group"?(()=>{const children=childrenOf(block.id);const expanded=expandedSteps.has(block.id);return <article className={`repeat-group-card ${expanded?"expanded":"collapsed"}`} key={block.id}>
        <header><button type="button" className="repeat-group-toggle" onClick={()=>toggleExpanded(block.id)} aria-expanded={expanded}><span>GROUP {index+1}</span><b>{block.title||"Repeat group"}</b><small>{formatTrainingStep(block,activityType)} · {children.length} {children.length===1?"step":"steps"}</small><em>{expanded?"⌃":"⌄"}</em></button><div><button type="button" disabled={index===0} onClick={()=>moveTopLevel(block.id,-1)} aria-label="Move group up">↑</button><button type="button" disabled={index===topLevelBlocks.length-1} onClick={()=>moveTopLevel(block.id,1)} aria-label="Move group down">↓</button><button type="button" className="remove-step" onClick={()=>removeBlock(block.id)} aria-label="Remove repeat group">×</button></div></header>
        {expanded&&<div className="repeat-group-body"><div className="step-field-grid"><label>GROUP NAME<input maxLength={120} value={block.title} onChange={event=>updateBlock(block.id,{title:event.target.value})} placeholder="Repeat group"/></label><label>ROUNDS<input inputMode="numeric" type="number" min="1" max="1000" value={block.repetitions||1} onChange={event=>updateBlock(block.id,{repetitions:Math.max(1,Number(event.target.value)||1)})}/></label></div><label className="step-full-field">GROUP INSTRUCTIONS<textarea value={block.instructions} onChange={event=>updateBlock(block.id,{instructions:event.target.value})} placeholder="Optional instructions for the whole group"/></label><div className="repeat-group-children">{children.map((child,childIndex)=><EnduranceStepCard key={child.id} block={child} label={`STEP ${index+1}.${childIndex+1}`} activityType={activityType} grouped expanded={expandedSteps.has(child.id)} canMoveUp={childIndex>0} canMoveDown={childIndex<children.length-1} onToggle={()=>toggleExpanded(child.id)} onUpdate={patch=>updateBlock(child.id,patch)} onMove={direction=>moveChild(block.id,child.id,direction)} onRemove={()=>removeBlock(child.id)} onUngroup={()=>ungroupChild(block.id,child.id)}/>)}</div><button type="button" className="add-group-step" onClick={()=>addGroupChild(block.id)}>＋ Add step to group</button></div>}
      </article>})():<EnduranceStepCard key={block.id} block={block} label={`STEP ${index+1}`} activityType={activityType} expanded={expandedSteps.has(block.id)} canMoveUp={index>0} canMoveDown={index<topLevelBlocks.length-1} onToggle={()=>toggleExpanded(block.id)} onUpdate={patch=>updateBlock(block.id,patch)} onMove={direction=>moveTopLevel(block.id,direction)} onRemove={()=>removeBlock(block.id)}/>) }
      <div className="step-add-actions"><button type="button" className="add-endurance-step" onClick={addBlock}>＋ Add session step</button><button type="button" className="add-repeat-group" onClick={addGroup}>↻ Add repeat group</button></div>
    </fieldset>
    <label className="endurance-field">SESSION NOTES<textarea value={notes} maxLength={2000} onChange={event=>setNotes(event.target.value)} placeholder="Optional notes"/></label>
    <button className="primary-button endurance-save">{completed?"Save completed activity":"Plan session"} <span>→</span></button>
  </form></section></div>;
}

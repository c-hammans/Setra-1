"use client";

import {notFound} from "next/navigation";
import {useEffect,useState} from "react";
import {PreviousSetButton} from "@/components/workout/previous-set-button";
import {useDialogFocusTrap} from "@/components/ui/use-dialog-focus-trap";
import {applyPreviousSetValues} from "@/lib/setra/workout-updates";
import type {Workout} from "@/lib/setra/types";

const storageKey="setra-use-previous-browser-test";
const initial:Workout={id:"browser-test",name:"Regression workout",date:"2026-09-21",startedAt:"09:00",duration:0,note:"unchanged",exercises:[{exerciseId:"bench",note:"keep",loadMode:"kg",sets:[{weight:"",reps:"",rpe:"7",done:false},{weight:"10",reps:"3",rpe:"8",done:true}]}]};
const previous={weight:"60",reps:"5",rpe:"9",done:true};

export default function UsePreviousBrowserHarness(){
  if(process.env.NODE_ENV==="production")notFound();
  const [workout,setWorkout]=useState(initial);
  const [restored,setRestored]=useState(false);
  const [dialogOpen,setDialogOpen]=useState(false);
  useDialogFocusTrap(dialogOpen);
  useEffect(()=>{const stored=window.localStorage.getItem(storageKey);if(stored)setWorkout(JSON.parse(stored) as Workout);setRestored(true)},[]);
  useEffect(()=>{if(restored)window.localStorage.setItem(storageKey,JSON.stringify(workout))},[restored,workout]);
  const set=workout.exercises[0].sets[0];
  if(!restored)return <main>Restoring test state…</main>;
  return <main><h1>Use previous regression harness</h1><label>Weight<input aria-label="Current weight" value={set.weight} onChange={event=>setWorkout(current=>{const next=structuredClone(current);next.exercises[0].sets[0].weight=event.target.value;return next})}/></label><label>Reps<input aria-label="Current reps" value={set.reps} onChange={event=>setWorkout(current=>{const next=structuredClone(current);next.exercises[0].sets[0].reps=event.target.value;return next})}/></label><PreviousSetButton label="60 kg × 5" onUse={()=>setWorkout(current=>applyPreviousSetValues(current,0,0,previous))}/><output aria-label="Visible result">{set.weight} × {set.reps} · RPE {set.rpe} · {set.done?"done":"not done"}</output><output aria-label="Unrelated set">{workout.exercises[0].sets[1].weight} × {workout.exercises[0].sets[1].reps} · {workout.exercises[0].sets[1].done?"done":"not done"}</output><button onClick={()=>setWorkout(structuredClone(initial))}>Reset</button><button onClick={()=>setDialogOpen(true)}>Open test dialog</button>{dialogOpen&&<div className="overlay"><section><h2>Focus test</h2><button data-dialog-initial-focus onClick={()=>setDialogOpen(false)}>Close dialog</button><button>Secondary action</button></section></div>}</main>;
}

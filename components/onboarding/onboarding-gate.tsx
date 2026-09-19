"use client";

import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/auth/auth-provider";
import {createClient} from "@/lib/supabase/client";
import type {TrainingPreference} from "@/lib/setra/types";
import {analytics} from "@/lib/analytics/events";

type Setup={trainingPreference:TrainingPreference;preferredUnit:"kg"|"lb";weeklySessionGoal:number|null};
const defaults:Setup={trainingPreference:"strength",preferredUnit:"kg",weeklySessionGoal:null};

export function OnboardingGate({children}:{children:React.ReactNode}){
  const {configured,user}=useAuth();const router=useRouter();const [checking,setChecking]=useState(configured);const [needed,setNeeded]=useState(false);const [setup,setSetup]=useState(defaults);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{if(!configured||!user){setChecking(false);return}let cancelled=false;createClient().from("profiles").select("onboarding_completed_at,training_preference,preferred_unit,weekly_session_goal").eq("id",user.id).single().then(({data,error})=>{if(cancelled)return;if(error){setNeeded(false);setChecking(false);return}setSetup({trainingPreference:["strength","endurance","hybrid"].includes(data.training_preference)?data.training_preference:"strength",preferredUnit:data.preferred_unit==="lb"?"lb":"kg",weeklySessionGoal:data.weekly_session_goal==null?null:Number(data.weekly_session_goal)});setNeeded(!data.onboarding_completed_at);setChecking(false)});return()=>{cancelled=true}},[configured,user]);
  async function complete(destination:"plan"|"import"){if(!user||busy)return;setBusy(true);setError("");const {error}=await createClient().from("profiles").update({training_preference:setup.trainingPreference,preferred_unit:setup.preferredUnit,weekly_session_goal:setup.weeklySessionGoal,onboarding_completed_at:new Date().toISOString()}).eq("id",user.id);if(error){setError("Your setup could not be saved. Please try again.");setBusy(false);return}analytics.track("onboarding_completed",{modality:setup.trainingPreference});setNeeded(false);router.push(destination==="import"?"/import":"/?tab=plan")}
  if(checking)return <main className="auth-shell"><div className="auth-loading"><span className="brand-mark">S</span><p>Preparing your diary…</p></div></main>;
  if(!needed)return <>{children}</>;
  return <main className="onboarding-screen"><section><small>WELCOME TO SETRA</small><h1>Set up your training diary.</h1><p>Choose what you train and how loads should appear. You can change these later in Profile.</p><fieldset><legend>YOUR TRAINING</legend>{(["strength","endurance","hybrid"] as TrainingPreference[]).map(value=><button type="button" key={value} className={setup.trainingPreference===value?"selected":""} onClick={()=>setSetup({...setup,trainingPreference:value})}>{value[0].toUpperCase()+value.slice(1)}</button>)}</fieldset><fieldset><legend>STRENGTH LOADS</legend>{(["kg","lb"] as const).map(value=><button type="button" key={value} className={setup.preferredUnit===value?"selected":""} onClick={()=>setSetup({...setup,preferredUnit:value})}>{value==="kg"?"Kilograms":"Pounds"}</button>)}</fieldset><label>SESSIONS PER WEEK (OPTIONAL)<select value={setup.weeklySessionGoal??""} onChange={event=>setSetup({...setup,weeklySessionGoal:event.target.value?Number(event.target.value):null})}><option value="">No goal yet</option>{Array.from({length:7},(_,index)=>index+1).map(value=><option value={value} key={value}>{value}</option>)}</select></label>{error&&<p role="alert" className="onboarding-error">{error}</p>}<div className="onboarding-actions"><button disabled={busy} onClick={()=>complete("plan")}>Plan my first session</button><button disabled={busy} onClick={()=>complete("import")}>Import a workout</button></div></section></main>;
}

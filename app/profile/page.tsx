"use client";

import Link from "next/link";
import {useEffect,useMemo,useState,type CSSProperties} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {loadLocalAppearance,loadLocalAppColour,loadLocalTextScale,saveLocalAppearance,saveLocalAppColour,saveLocalTextScale} from "@/lib/data/local-diary";
import {ProfileService,type ProfileSettings} from "@/lib/profile/profile-service";
import {usePremiumAccess} from "@/lib/premium/use-premium-access";
import {contrastColour,textScalePercent,useResolvedAppearance,type TextScale} from "@/lib/setra/appearance";
import "./profile.css";

const colours=[{name:"Blue",value:"#409ECE"},{name:"Coral",value:"#FF6B6B"},{name:"Yellow",value:"#F6C445"},{name:"Green",value:"#55B96D"},{name:"Purple",value:"#8B72D9"},{name:"Grey",value:"#6B7280"}];
const defaults:ProfileSettings={displayName:"",fullName:"",dateOfBirth:"",preferredUnit:"kg",trainingGoal:"",experienceLevel:"",trainingPreference:"strength",appColour:"#409ECE",appearanceMode:"system",textScale:1,showWorkoutTimingPopup:true,showPbPopup:true};
const mixHex=(foreground:string,background:string,amount:number)=>{const read=(colour:string,index:number)=>Number.parseInt(colour.slice(index,index+2),16);const channel=(index:number)=>Math.round(read(foreground,index)*amount+read(background,index)*(1-amount)).toString(16).padStart(2,"0");return `#${channel(1)}${channel(3)}${channel(5)}`};
const initials=(name:string,email?:string)=>{const words=name.trim().split(/\s+/).filter(Boolean);return (words.length?words.map(word=>word[0]).join("").slice(0,3):(email?.[0]||"S")).toUpperCase()};

export default function ProfilePage(){
  const {user,signOut}=useAuth();
  const {subscription}=usePremiumAccess();
  const service=useMemo(()=>user?new ProfileService(user.id):null,[user]);
  const [settings,setSettings]=useState<ProfileSettings>(defaults);
  const [saved,setSaved]=useState<ProfileSettings>(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const resolvedAppearance=useResolvedAppearance(settings.appearanceMode);

  useEffect(()=>{if(!service)return;const cached=loadLocalAppColour(user?.id);const cachedAppearance=loadLocalAppearance(user?.id);const cachedTextScale=loadLocalTextScale(user?.id);if(cached||cachedAppearance||cachedTextScale)setSettings(current=>({...current,...(cached?{appColour:cached}:{}),...(cachedAppearance?{appearanceMode:cachedAppearance}:{}),...(cachedTextScale?{textScale:cachedTextScale}:{})}));service.load().then(profile=>{const next={...profile,displayName:profile.displayName||user?.user_metadata?.display_name||""};setSettings(next);setSaved(next);saveLocalTextScale(next.textScale,user?.id)}).catch(error=>setMessage(error instanceof Error?error.message:"Profile settings could not be loaded.")).finally(()=>setLoading(false))},[service,user?.id,user?.user_metadata?.display_name]);
  const dirty=JSON.stringify(settings)!==JSON.stringify(saved);
  async function save(){if(!service||saving)return;setSaving(true);setMessage("");try{await service.save(settings);saveLocalAppColour(settings.appColour,user?.id);saveLocalAppearance(settings.appearanceMode,user?.id);saveLocalTextScale(settings.textScale,user?.id);setSaved(settings);setMessage("Settings saved ✓")}catch(error){setMessage(error instanceof Error?error.message:"Settings could not be saved.")}finally{setSaving(false)}}
  const contrast=contrastColour(settings.appColour);
  const theme={"--accent":settings.appColour,"--accent-contrast":contrast,"--accent-soft":mixHex(settings.appColour,"#FFFFFF",resolvedAppearance==="dark"?.78:.7),"--accent-ink":resolvedAppearance==="dark"?mixHex(settings.appColour,"#FFFFFF",.76):mixHex(settings.appColour,"#0F172A",.72),"--accent-tint":mixHex(settings.appColour,resolvedAppearance==="dark"?"#10151D":"#FFFFFF",resolvedAppearance==="dark"?.18:.11),"--accent-border":mixHex(settings.appColour,resolvedAppearance==="dark"?"#10151D":"#FFFFFF",resolvedAppearance==="dark"?.5:.34),"--text-scale-percent":textScalePercent(settings.textScale),"--text-scale-number":settings.textScale} as CSSProperties;

  return <main className="profile-screen" style={theme} data-light-accent={contrast==="#0F172A"} data-theme={resolvedAppearance}>
    <header className="profile-header"><Link href="/" aria-label="Back to Setra"><span aria-hidden="true">‹</span></Link><b>Profile</b><span/></header>
    <div className="profile-content">
      <section className="profile-identity"><span>{initials(settings.displayName,user?.email)}</span><div><small>{subscription.tier==="premium"?"SETRA PREMIUM":"SETRA ATHLETE"}</small><h1>{settings.displayName||"Your profile"}</h1><p>{user?.email}</p></div></section>

      <section className="profile-section"><header><span>YOUR DETAILS</span><h2>Account details</h2></header><label className="profile-field">NAME<input disabled={loading} maxLength={120} value={settings.fullName} onChange={event=>setSettings({...settings,fullName:event.target.value})} placeholder="Your full name"/></label><label className="profile-field">DISPLAY NAME<input disabled={loading} maxLength={60} value={settings.displayName} onChange={event=>setSettings({...settings,displayName:event.target.value})} placeholder="Shown throughout Setra"/></label><label className="profile-field">DATE OF BIRTH<input type="date" disabled={loading} value={settings.dateOfBirth} onChange={event=>setSettings({...settings,dateOfBirth:event.target.value})}/></label><label className="profile-field">EMAIL<input value={user?.email||""} disabled/></label><div className="profile-field-grid"><label className="profile-field">PREFERRED UNIT<select value={settings.preferredUnit} onChange={event=>setSettings({...settings,preferredUnit:event.target.value as "kg"|"lb"})}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label><label className="profile-field">EXPERIENCE<select value={settings.experienceLevel} onChange={event=>setSettings({...settings,experienceLevel:event.target.value as ProfileSettings["experienceLevel"]})}><option value="">Not selected</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div><label className="profile-field">TRAINING GOAL<textarea maxLength={240} value={settings.trainingGoal} onChange={event=>setSettings({...settings,trainingGoal:event.target.value})} placeholder="What are you currently training towards?"/></label></section>

      <section className="profile-section"><header><span>APPEARANCE</span><h2>Accent Colour</h2></header><div className="profile-colours">{colours.map(colour=><button key={colour.value} type="button" className={settings.appColour===colour.value?"selected":""} aria-label={`Use ${colour.name}`} title={colour.name} onClick={()=>setSettings({...settings,appColour:colour.value})}><i style={{background:colour.value,color:contrastColour(colour.value)}}>{settings.appColour===colour.value?"✓":""}</i></button>)}</div><div className="appearance-setting"><span>APP APPEARANCE</span><div>{([['light','Light'],['dark','Dark'],['system','Match system']] as const).map(([value,label])=><button type="button" key={value} className={settings.appearanceMode===value?"selected":""} onClick={()=>setSettings({...settings,appearanceMode:value})}>{label}</button>)}</div></div><div className="text-size-setting"><div><span>TEXT SIZE</span><output>{Math.round(settings.textScale*100)}%</output></div><div className="text-size-options">{([1,1.1,1.2,1.3] as TextScale[]).map((scale,index)=><button type="button" key={scale} className={settings.textScale===scale?"selected":""} aria-label={`Use ${Math.round(scale*100)} percent text size`} onClick={()=>setSettings({...settings,textScale:scale})}><b style={{fontSize:`${12+index*2}px`}}>A</b><small>{Math.round(scale*100)}%</small></button>)}</div></div></section>

      <section className="profile-section"><header><span>TRAINING</span><h2>How do you use Setra?</h2><p>Choose which training experience appears in the app. Changing this never removes your saved training data.</p></header><div className="training-preference-options">{([['strength','Strength','Strength planning, live workouts and exercise progress.'],['endurance','Endurance','Running, cycling, swimming and other endurance sessions.'],['hybrid','Hybrid','Strength and endurance shown together.']] as const).map(([value,label,description])=><button type="button" key={value} className={settings.trainingPreference===value?"selected":""} aria-pressed={settings.trainingPreference===value} onClick={()=>setSettings({...settings,trainingPreference:value})}><span>{label}</span><small>{description}</small></button>)}</div></section>

      {settings.trainingPreference!=="endurance"&&<section className="profile-section"><header><span>WORKOUTS</span><h2>Session preferences</h2></header><label className="profile-toggle"><span><b>Confirm workout times</b><small>Ask for start and finish times when completing a session.</small></span><input aria-label="Confirm workout times" type="checkbox" checked={settings.showWorkoutTimingPopup} onChange={event=>setSettings({...settings,showWorkoutTimingPopup:event.target.checked})}/><i/></label><label className="profile-toggle"><span><b>Celebrate new PBs</b><small>Show the shareable PB popup after a workout.</small></span><input aria-label="Celebrate new PBs" type="checkbox" checked={settings.showPbPopup} onChange={event=>setSettings({...settings,showPbPopup:event.target.checked})}/><i/></label></section>}

      <section className="profile-premium"><span>✦ SETRA PREMIUM</span><h2>{subscription.tier==="premium"?"Premium access active":"Go further with your training record."}</h2><p>AI Coach, personal programming, deeper reviews and advanced insights are being built around your Setra history.</p><Link href="/premium">{subscription.tier==="premium"?"View Premium":"Explore Premium"} <b>→</b></Link></section>

      <section className="profile-section profile-account"><header><span>ACCOUNT</span><h2>Cloud diary</h2></header><div className="profile-cloud"><i/>Your Setra data is connected to your account.</div><button onClick={signOut}>Sign out</button></section>
    </div>
    <footer className="profile-save"><div>{message&&<small>{message}</small>}<button disabled={!dirty||saving||loading} onClick={save}>{saving?"Saving…":dirty?"Save settings":"Settings saved ✓"}</button></div></footer>
  </main>;
}

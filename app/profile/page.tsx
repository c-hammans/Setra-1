"use client";

import Link from "next/link";
import {useEffect,useMemo,useState,type CSSProperties} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {loadLocalAppColour,saveLocalAppColour} from "@/lib/data/local-diary";
import {ProfileService,type ProfileSettings} from "@/lib/profile/profile-service";
import {usePremiumAccess} from "@/lib/premium/use-premium-access";
import "./profile.css";

const colours=[{name:"Blue",value:"#409ECE"},{name:"Coral",value:"#FF6B6B"},{name:"Yellow",value:"#F6C445"},{name:"Green",value:"#55B96D"},{name:"Purple",value:"#8B72D9"},{name:"Black",value:"#000000"},{name:"White",value:"#FFFFFF"}];
const lightColours=new Set(["#F6C445","#FFFFFF"]);
const defaults:ProfileSettings={displayName:"",appColour:"#409ECE",showWorkoutTimingPopup:true,showPbPopup:true};
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

  useEffect(()=>{if(!service)return;const cached=loadLocalAppColour(user?.id);if(cached)setSettings(current=>({...current,appColour:cached}));service.load().then(profile=>{const next={...profile,displayName:profile.displayName||user?.user_metadata?.display_name||""};setSettings(next);setSaved(next)}).catch(error=>setMessage(error instanceof Error?error.message:"Profile settings could not be loaded.")).finally(()=>setLoading(false))},[service,user?.id,user?.user_metadata?.display_name]);
  const dirty=JSON.stringify(settings)!==JSON.stringify(saved);
  async function save(){if(!service||saving)return;setSaving(true);setMessage("");try{await service.save(settings);saveLocalAppColour(settings.appColour,user?.id);setSaved(settings);setMessage("Settings saved ✓")}catch(error){setMessage(error instanceof Error?error.message:"Settings could not be saved.")}finally{setSaving(false)}}
  const contrast=lightColours.has(settings.appColour)?"#0F172A":"#FFFFFF";
  const theme={"--accent":settings.appColour,"--accent-contrast":contrast,"--accent-soft":mixHex(settings.appColour,"#FFFFFF",.7),"--accent-ink":mixHex(settings.appColour,"#0F172A",.72),"--accent-tint":mixHex(settings.appColour,"#FFFFFF",.11),"--accent-border":mixHex(settings.appColour,"#FFFFFF",.34)} as CSSProperties;

  return <main className="profile-screen" style={theme} data-light-accent={lightColours.has(settings.appColour)}>
    <header className="profile-header"><Link href="/" aria-label="Back to Setra">‹</Link><b>Profile</b><span/></header>
    <div className="profile-content">
      <section className="profile-identity"><span>{initials(settings.displayName,user?.email)}</span><div><small>{subscription.tier==="premium"?"SETRA PREMIUM":"SETRA ATHLETE"}</small><h1>{settings.displayName||"Your profile"}</h1><p>{user?.email}</p></div></section>

      <section className="profile-section"><header><span>YOUR DETAILS</span><h2>Account</h2></header><label className="profile-field">DISPLAY NAME<input disabled={loading} maxLength={60} value={settings.displayName} onChange={event=>setSettings({...settings,displayName:event.target.value})} placeholder="Your name"/></label><label className="profile-field">EMAIL<input value={user?.email||""} disabled/></label></section>

      <section className="profile-section"><header><span>APPEARANCE</span><h2>App colour</h2></header><div className="profile-colours">{colours.map(colour=><button key={colour.value} type="button" className={settings.appColour===colour.value?"selected":""} aria-label={`Use ${colour.name}`} title={colour.name} onClick={()=>setSettings({...settings,appColour:colour.value})}><i style={{background:colour.value}}>{settings.appColour===colour.value?"✓":""}</i></button>)}</div></section>

      <section className="profile-section"><header><span>WORKOUTS</span><h2>Session preferences</h2></header><label className="profile-toggle"><span><b>Confirm workout times</b><small>Ask for start and finish times when completing a session.</small></span><input type="checkbox" checked={settings.showWorkoutTimingPopup} onChange={event=>setSettings({...settings,showWorkoutTimingPopup:event.target.checked})}/><i/></label><label className="profile-toggle"><span><b>Celebrate new PBs</b><small>Show the shareable PB popup after a workout.</small></span><input type="checkbox" checked={settings.showPbPopup} onChange={event=>setSettings({...settings,showPbPopup:event.target.checked})}/><i/></label></section>

      <section className="profile-premium"><span>✦ SETRA PREMIUM</span><h2>{subscription.tier==="premium"?"Premium access active":"Go further with your training record."}</h2><p>AI Coach, personal programming, deeper reviews and advanced insights are being built around your Setra history.</p><Link href="/premium">{subscription.tier==="premium"?"View Premium":"Explore Premium"} <b>→</b></Link></section>

      <section className="profile-section profile-account"><header><span>ACCOUNT</span><h2>Cloud diary</h2></header><div className="profile-cloud"><i/>Your Setra data is connected to your account.</div><button onClick={signOut}>Sign out</button></section>
    </div>
    <footer className="profile-save"><div>{message&&<small>{message}</small>}<button disabled={!dirty||saving||loading} onClick={save}>{saving?"Saving…":dirty?"Save settings":"Settings saved ✓"}</button></div></footer>
  </main>;
}

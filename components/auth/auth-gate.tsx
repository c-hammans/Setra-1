"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./auth-provider";

type Mode = "signin"|"signup"|"reset";

export function AuthGate({children}:{children:React.ReactNode}) {
  const {configured,loading,user}=useAuth();
  const [mode,setMode]=useState<Mode>("signin");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [displayName,setDisplayName]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  if(!configured) return <>{children}</>;
  if(loading) return <main className="auth-shell"><div className="auth-loading"><span className="brand-mark">S</span><p>Opening your training diary…</p></div></main>;
  if(user) return <>{children}</>;

  async function submit(event:React.FormEvent){
    event.preventDefault();setBusy(true);setMessage("");
    const supabase=createClient();
    if(mode==="signin"){
      const {error}=await supabase.auth.signInWithPassword({email,password});
      setMessage(error?error.message:"");
    } else if(mode==="signup") {
      const site=process.env.NEXT_PUBLIC_SITE_URL||window.location.origin;
      const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName.trim()},emailRedirectTo:`${site}/auth/callback`}});
      setMessage(error?error.message:"Check your email to confirm your Setra account.");
    } else {
      const site=process.env.NEXT_PUBLIC_SITE_URL||window.location.origin;
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${site}/auth/callback?next=/auth/reset-password`});
      setMessage(error?error.message:"Password reset email sent.");
    }
    setBusy(false);
  }

  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">S</span><b>setra</b></div><span className="eyebrow">YOUR TRAINING DIARY</span><h1>{mode==="signin"?"Welcome back":mode==="signup"?"Create your account":"Reset your password"}</h1><p>{mode==="signin"?"Sign in to plan, train and keep your history together.":mode==="signup"?"Your workouts will be private and available across your devices.":"We’ll email you a secure reset link."}</p><form onSubmit={submit}>{mode==="signup"&&<label>NAME<input value={displayName} onChange={event=>setDisplayName(event.target.value)} autoComplete="name" required placeholder="Your name"/></label>}<label>EMAIL<input type="email" value={email} onChange={event=>setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>{mode!=="reset"&&<label>PASSWORD<input type="password" minLength={8} value={password} onChange={event=>setPassword(event.target.value)} autoComplete={mode==="signin"?"current-password":"new-password"} required placeholder="At least 8 characters"/></label>}<button className="primary-button" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":mode==="signup"?"Create account":"Send reset email"}</button></form>{message&&<p className="auth-message" role="status">{message}</p>}<div className="auth-links">{mode!=="signin"?<button onClick={()=>{setMode("signin");setMessage("")}}>Already have an account? Sign in</button>:<><button onClick={()=>{setMode("signup");setMessage("")}}>Create an account</button><button onClick={()=>{setMode("reset");setMessage("")}}>Forgot password?</button></>}</div></section></main>;
}

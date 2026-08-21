"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage(){
  const [password,setPassword]=useState("");const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent){event.preventDefault();setBusy(true);const {error}=await createClient().auth.updateUser({password});setMessage(error?error.message:"Password updated. You can return to Setra.");setBusy(false)}
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">S</span><b>setra</b></div><span className="eyebrow">ACCOUNT SECURITY</span><h1>Choose a new password</h1><form onSubmit={submit}><label>NEW PASSWORD<input type="password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)} autoComplete="new-password"/></label><button className="primary-button" disabled={busy}>{busy?"Updating…":"Update password"}</button></form>{message&&<p className="auth-message">{message}</p>}<a className="auth-return" href="/">Return to Setra</a></section></main>;
}

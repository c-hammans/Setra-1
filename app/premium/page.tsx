"use client";

import Link from "next/link";
import {useEffect,useState,type CSSProperties} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {CoachConversationPlaceholder,PremiumBadge,PremiumFeatureCard,RecommendationPlaceholder,TrainingInsightPlaceholder} from "@/components/premium";
import {loadLocalAppearance,loadLocalAppColour} from "@/lib/data/local-diary";
import {usePremiumAccess} from "@/lib/premium/use-premium-access";
import {contrastColour,useResolvedAppearance,type AppearanceMode} from "@/lib/setra/appearance";
import "./premium.css";
import {NavIcon} from "@/components/navigation/nav-icon";

export default function PremiumPage(){
  const {user}=useAuth();
  const {subscription,service}=usePremiumAccess();
  const [appColour,setAppColour]=useState("#409ECE");
  const [appearanceMode,setAppearanceMode]=useState<AppearanceMode>("system");
  const [email,setEmail]=useState(user?.email||"");
  const [joined,setJoined]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");

  const resolvedAppearance=useResolvedAppearance(appearanceMode);
  useEffect(()=>{const colour=loadLocalAppColour(user?.id);const appearance=loadLocalAppearance(user?.id);if(colour)setAppColour(colour);if(appearance)setAppearanceMode(appearance)},[user?.id]);
  useEffect(()=>{if(user?.email)setEmail(user.email)},[user?.email]);
  useEffect(()=>{if(!service)return;service.hasJoinedWaitlist().then(setJoined).catch(()=>setJoined(false))},[service]);

  async function submitWaitlist(event:React.FormEvent){
    event.preventDefault();if(!service||!email||busy)return;setBusy(true);setMessage("");
    try{await service.joinWaitlist(email);setJoined(true)}catch(error){setMessage(error instanceof Error?error.message:"We couldn’t save your interest just yet. Please try again.")}finally{setBusy(false)}
  }

  const contrast=contrastColour(appColour);
  return <main className="premium-shell" data-theme={resolvedAppearance} style={{"--accent":appColour,"--accent-contrast":contrast} as CSSProperties}>
    <header className="premium-topbar"><Link className="premium-brand" href="/"><span className="premium-brand-mark"/><b>setra</b></Link><PremiumBadge/></header>

    <section className="premium-hero"><span>THE NEXT LAYER OF YOUR TRAINING DIARY</span><h1>The work<br/><em>adds up.</em></h1><p>Setra Premium is being designed to turn the training you already record into clearer decisions, more personal programming and a coach that understands your history.</p><a href="#early-access">Join early access <b>→</b></a><div className="premium-status"><i/>{subscription.tier==="premium"?"Premium access active":"Premium is in development"}</div></section>

    <section className="premium-vision"><span>THE VISION</span><h2>Your record becomes useful in a new way.</h2><p>Not a generic chatbot. Not another dashboard full of noise. Setra Premium will be built around your sessions, exercises, patterns and goals—with the training diary remaining at the centre.</p></section>

    <section className="coach-preview"><div className="premium-section-heading"><span>AI COACH</span><h2>A coach with context.</h2><p>A future conversation layer designed to understand what you planned, what you completed and how your training is changing.</p></div><CoachConversationPlaceholder/><div className="coach-support-grid"><RecommendationPlaceholder/><TrainingInsightPlaceholder/></div></section>

    <section className="premium-feature-section"><div className="premium-section-heading"><span>PREMIUM TOOLKIT</span><h2>More clarity. Better decisions.</h2></div><div className="premium-feature-grid"><PremiumFeatureCard feature="personalised_programming"/><PremiumFeatureCard feature="weekly_reviews"/><PremiumFeatureCard feature="advanced_analytics"/><PremiumFeatureCard feature="recovery_insights"/><PremiumFeatureCard feature="premium_integrations"/></div></section>

    <section className="premium-value"><PremiumBadge/><blockquote>“Keep the simplicity of Setra. Add intelligence only where it makes training better.”</blockquote><div><span>PERSONAL</span><span>EXPLAINABLE</span><span>BUILT FROM YOUR RECORD</span></div></section>

    <section className="premium-waitlist" id="early-access"><span>EARLY ACCESS</span>{joined?<div className="waitlist-success"><i>✓</i><h2>You’re on the list.</h2><p>We’ll use your account email to keep you informed as Setra Premium develops.</p></div>:<><h2>Help shape what comes next.</h2><p>Register your interest in AI Coach, deeper insights and future Premium tools. There is no payment and no subscription yet.</p><form onSubmit={submitWaitlist}><label>EMAIL<input type="email" required value={email} readOnly={Boolean(user?.email)} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com"/></label><button disabled={busy}>{busy?"Joining…":"Join early access"} <b>→</b></button></form>{message&&<small role="alert">{message}</small>}<em>Coming soon · No payment details required</em></>}</section>

    <nav className="premium-bottom-nav" aria-label="Main navigation"><Link href="/"><NavIcon name="today"/><small>Today</small></Link><Link href="/?tab=plan"><NavIcon name="plan"/><small>Plan</small></Link><Link href="/?tab=history"><NavIcon name="history"/><small>History</small></Link><Link href="/?tab=pbs"><NavIcon name="pbs"/><small>PBs</small></Link><Link className="selected" href="/premium"><NavIcon name="premium"/><small>Premium</small></Link></nav>
  </main>;
}

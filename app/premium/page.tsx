"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { NavIcon } from "@/components/navigation/nav-icon";
import { PremiumBadge } from "@/components/premium";
import {PlusFeatureHub} from "@/components/premium/plus-feature-hub";
import { loadLocalAppearance, loadLocalAppColour, loadLocalTextScale } from "@/lib/data/local-diary";
import {DiaryService} from "@/lib/data/diary-service";
import { FEATURE_CATALOGUE, PLAN_CATALOGUE, PLAN_ORDER } from "@/lib/premium/access";
import {BillingPanel} from "@/components/billing/billing-panel";
import { usePremiumAccess } from "@/lib/premium/use-premium-access";
import { createSetraTheme, useResolvedAppearance, type AppearanceMode, type TextScale } from "@/lib/setra/appearance";
import "./premium.css";

export default function PremiumPage() {
  const { user } = useAuth();
  const { access, service, loading } = usePremiumAccess();
  const [showStrength,setShowStrength]=useState(true);
  const [appColour, setAppColour] = useState("#409ECE");
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("system");
  const [textScale, setTextScale] = useState<TextScale>(1);
  const [email, setEmail] = useState(user?.email || "");
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const resolvedAppearance = useResolvedAppearance(appearanceMode);
  useEffect(() => {
    const colour = loadLocalAppColour(user?.id);
    const appearance = loadLocalAppearance(user?.id);
    const scale = loadLocalTextScale(user?.id);
    if (colour) setAppColour(colour);
    if (appearance) setAppearanceMode(appearance);
    if (scale) setTextScale(scale);
  }, [user?.id]);
  useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  useEffect(()=>{
    if(!user?.id)return;
    let live=true;
    void new DiaryService(user.id).loadProfile().then(profile=>{if(live)setShowStrength(profile.trainingPreference!=="endurance")}).catch(()=>{});
    return ()=>{live=false};
  },[user?.id]);
  useEffect(() => {
    if (!service) return;
    service.hasJoinedWaitlist().then(setJoined).catch(() => setJoined(false));
  }, [service]);

  async function submitWaitlist(event: React.FormEvent) {
    event.preventDefault();
    if (!service || !email || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await service.joinWaitlist(email);
      setJoined(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't save your interest just yet. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="premium-shell" data-theme={resolvedAppearance} style={createSetraTheme(appColour, resolvedAppearance, textScale)}>
    <header className="premium-topbar">
      <Link className="premium-brand" href="/"><span className="premium-brand-mark" /><b>setra</b></Link>
    </header>
    <PlusFeatureHub access={access} loading={loading}/>

    <section className="premium-plans" id="plans">
      <div className="premium-section-heading">
        <span>PLANS</span>
        <h2>Built in clear layers.</h2>
        <p>Individual plans and coaching are separate. Existing beta access is preserved.</p>
      </div>
      <div className="premium-plan-grid">
        {PLAN_ORDER.map((planId) => {
          const plan = PLAN_CATALOGUE[planId];
          const current = access.plan === planId;
          return <article className={`premium-plan-card ${current ? "current" : ""}`} key={plan.id}>
            <header>
              <div><span>{plan.displayName.toUpperCase()}</span>{current && <small>CURRENT PLAN</small>}</div>
              <b data-status={planId==="free"?"available":"early_access"}>{planId==="free"?"Available now":"Test billing only"}</b>
            </header>
            <h3>{plan.description}</h3>
            {plan.inherits && <p className="premium-inheritance">Everything in {PLAN_CATALOGUE[plan.inherits].displayName}, plus:</p>}
            {!plan.inherits && <p className="premium-inheritance">The complete core training product:</p>}
            <ul>
              {plan.entitlements.map((feature) => {
                const item = FEATURE_CATALOGUE[feature];
                return <li key={feature}>
                  <span aria-hidden="true">{item.availability === "available_now" ? "✓" : "+"}</span>
                  <div><strong>{item.title}</strong><small>{item.description}</small></div>
                  <em>{item.availability === "available_now" ? "Available now" : "Coming soon"}</em>
                </li>;
              })}
            </ul>
          </article>;
        })}
      </div>
      <p className="premium-plan-note">Live payments are not enabled. Roadmap items are marked Coming soon.</p>
    </section>
    <div className="plus-billing-wrap"><BillingPanel kind="individual"/></div>

    <section className="premium-value">
      <PremiumBadge />
      <blockquote>“The training diary stays at the centre. New tools earn their place by making the record more useful.”</blockquote>
      <div><span>CORE TRAINING STAYS FREE</span><span>NO CLIENT-SIDE UPGRADES</span><span>USER-CONTROLLED ADAPTATION</span></div>
    </section>

    <section className="premium-waitlist" id="early-access">
      <span>EARLY ACCESS</span>
      {joined ? <div className="waitlist-success"><i>✓</i><h2>You&apos;re on the list.</h2><p>We&apos;ll use your account email to keep you informed as Premium and Adaptive develop.</p></div> : <>
        <h2>Help shape what comes next.</h2>
        <p>Register your interest in future improvements. Joining the list doesn’t start a subscription.</p>
        <form onSubmit={submitWaitlist}>
          <label>EMAIL<input type="email" required value={email} readOnly={Boolean(user?.email)} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button disabled={busy}>{busy ? "Joining…" : "Join early access"} <b>→</b></button>
        </form>
        {message && <small role="alert">{message}</small>}
        <em>Coming soon · No payment details required</em>
      </>}
    </section>

    <nav className="premium-bottom-nav" aria-label="Main navigation" style={{gridTemplateColumns:`repeat(${showStrength?5:4},minmax(0,1fr))`}}>
      <Link href="/"><NavIcon name="today" /><small>Today</small></Link>
      <Link href="/?tab=plan"><NavIcon name="plan" /><small>Plan</small></Link>
      <Link href="/?tab=history"><NavIcon name="history" /><small>History</small></Link>
      {showStrength&&<Link href="/?tab=pbs"><NavIcon name="pbs" /><small>PBs</small></Link>}
      <Link className="selected" href="/premium" aria-current="page"><NavIcon name="premium" /><small>Plus</small></Link>
    </nav>
  </main>;
}

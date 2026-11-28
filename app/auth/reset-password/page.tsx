"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  async function endRecoverySession() {
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      setSignedOut(true);
      setMessage("");
    } catch {
      setMessage("Your password was updated, but Setra couldn’t close the reset session. Try signing out again.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || updated) return;
    if (password !== confirmation) {
      setMessage("The passwords don’t match. Enter the same new password twice.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        if (error.code === "same_password") {
          setMessage("Choose a password different from your previous password.");
        } else if (error.code === "weak_password") {
          setMessage("Choose a stronger password and try again.");
        } else {
          setMessage("Setra couldn’t update your password. Request a fresh reset link from the sign-in screen and try again.");
        }
        return;
      }
      setUpdated(true);
      setPassword("");
      setConfirmation("");
      await endRecoverySession();
    } catch {
      setMessage("Setra couldn’t reach the account service. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function retrySignOut() {
    setBusy(true);
    await endRecoverySession();
    setBusy(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span className="brand-mark">S</span><b>setra</b></div>
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h1>{updated ? "Password updated" : "Choose a new password"}</h1>
        {updated ? (
          signedOut
            ? <Link className="auth-return" href="/">Sign in with your new password</Link>
            : <button className="primary-button" disabled={busy} onClick={() => void retrySignOut()}>
                {busy ? "Signing out…" : "Try signing out again"}
              </button>
        ) : (
          <>
            <form onSubmit={submit}>
              <label>NEW PASSWORD<input type={showPasswords ? "text" : "password"} autoCapitalize="none" spellCheck={false} minLength={8} required value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password"/></label>
              <label>CONFIRM NEW PASSWORD<input type={showPasswords ? "text" : "password"} autoCapitalize="none" spellCheck={false} minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password"/></label>
              <button type="button" className="auth-return" aria-pressed={showPasswords} onClick={() => setShowPasswords(visible => !visible)}>
                {showPasswords ? "Hide passwords" : "Show passwords"}
              </button>
              <button className="primary-button" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
            </form>
            <Link className="auth-return" href="/">Return to Setra</Link>
          </>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
      </section>
    </main>
  );
}

/* ============================================================================
   Sign in / create an account / recover a password — our own component, email
   and password only.

   Dressed in the Council Seal language (plate, brass studs, segmented intent,
   parchment primary) and talking only to `useAuth()`, never to the auth
   provider directly. Signing in is optional to play; it is what holds a seat
   and what the admin console checks.
   ========================================================================== */

import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, MailCheck } from "lucide-react";
import { MIN_PASSWORD, RESET_CODE_LENGTH, useAuth, type AuthFlow } from "./auth";

/**
 * Four screens, one card. The two reset steps are a mode rather than a
 * separate page so the email already typed carries straight through.
 */
type Mode = AuthFlow | "resetRequest" | "resetVerify";

export function SignInCard({ onDone }: { onDone?: () => void }) {
  const {
    signInWithEmail, createAccount, requestPasswordReset, completePasswordReset,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const creating = mode === "signUp";
  const recovering = mode === "resetRequest" || mode === "resetVerify";

  const go = (next: Mode) => {
    setMode(next);
    setErr("");
    if (next === "signIn" || next === "signUp") setCode("");
  };

  const ready = (() => {
    if (mode === "resetRequest") return email.trim().length > 0;
    if (mode === "resetVerify") {
      return code.trim().length === RESET_CODE_LENGTH && password.length >= MIN_PASSWORD;
    }
    return email.trim().length > 0 && password.length >= MIN_PASSWORD;
  })();

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr("");

    const res =
      mode === "signUp" ? await createAccount(email, password)
      : mode === "signIn" ? await signInWithEmail(email, password)
      : mode === "resetRequest" ? await requestPasswordReset(email)
      : await completePasswordReset(email, code, password);

    if (!res.ok) {
      setErr(res.error);
      setBusy(false);
      return;
    }

    if (mode === "resetRequest") {
      // Not signed in yet — move to the code step and clear the old password.
      setPassword("");
      setMode("resetVerify");
      setBusy(false);
      return;
    }
    // Everything else lands a session; the card unmounts, so `busy` can stand.
    onDone?.();
  };

  const eyebrow =
    mode === "signUp" ? "Join the council"
    : mode === "resetRequest" ? "Recover your account"
    : mode === "resetVerify" ? "A code was sent"
    : "Enter the council";

  return (
    <div className="vd-plate vd-studded vd-signin">
      <span className="vd-stud-b" aria-hidden />

      <div className="vd-label vd-signin__eyebrow">{eyebrow}</div>

      {/* Two intents, one form — the segmented group the table uses. Hidden
          while recovering: that is a detour, not a third peer. */}
      {!recovering && (
        <div className="vd-seg vd-signin__seg" role="tablist">
          <button
            type="button" role="tab" aria-selected={!creating}
            className={`vd-signin__tab ${creating ? "" : "is-active"}`}
            onClick={() => go("signIn")}
          >
            Sign in
          </button>
          <button
            type="button" role="tab" aria-selected={creating}
            className={`vd-signin__tab ${creating ? "is-active" : ""}`}
            onClick={() => go("signUp")}
          >
            Create account
          </button>
        </div>
      )}

      {mode === "resetVerify" ? (
        <p className="vd-voice vd-signin__sent">
          <MailCheck size={14} /> If <strong>{email.trim().toLowerCase()}</strong> has
          an account, a {RESET_CODE_LENGTH}-digit code is on its way. It lasts 15 minutes.
        </p>
      ) : (
        <>
          <label className="vd-field__label" htmlFor="si-email">Email</label>
          <input
            id="si-email"
            className="vd-field"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />
        </>
      )}

      {mode === "resetVerify" && (
        <>
          <label className="vd-field__label" htmlFor="si-code">Your code</label>
          <input
            id="si-code"
            className="vd-field vd-field--code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={RESET_CODE_LENGTH}
            placeholder={"0".repeat(RESET_CODE_LENGTH)}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />
        </>
      )}

      {mode !== "resetRequest" && (
        <>
          <label className="vd-field__label" htmlFor="si-pass">
            {mode === "resetVerify" ? "New password" : "Password"}
          </label>
          <div className="vd-signin__pass">
            <input
              id="si-pass"
              className="vd-field"
              type={reveal ? "text" : "password"}
              autoComplete={creating || mode === "resetVerify" ? "new-password" : "current-password"}
              placeholder={
                creating || mode === "resetVerify"
                  ? `at least ${MIN_PASSWORD} characters`
                  : "password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            />
            <button
              type="button"
              className="vd-signin__peek"
              onClick={() => setReveal((r) => !r)}
              aria-label={reveal ? "Hide password" : "Show password"}
              title={reveal ? "Hide password" : "Show password"}
            >
              {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </>
      )}

      <button
        className="vd-btn vd-btn--primary"
        disabled={!ready || busy}
        onClick={() => void submit()}
      >
        <span>
          {mode === "signUp" ? "Create account"
            : mode === "resetRequest" ? "Send me a code"
            : mode === "resetVerify" ? "Set new password"
            : "Sign in"}
        </span>
        {busy ? <Loader2 size={15} className="vd-spin" /> : <KeyRound size={15} />}
      </button>

      {err && <p className="vd-errline">{err}</p>}

      <div className="vd-signin__foot">
        {mode === "signIn" && (
          <button type="button" className="vd-textbtn" onClick={() => go("resetRequest")}>
            Forgot your password?
          </button>
        )}
        {recovering && (
          <button type="button" className="vd-textbtn" onClick={() => go("signIn")}>
            <ArrowLeft size={11} /> Back to sign in
          </button>
        )}
        {mode === "resetVerify" && (
          <button
            type="button"
            className="vd-textbtn"
            onClick={() => { setCode(""); go("resetRequest"); }}
          >
            Send another
          </button>
        )}
      </div>

      {!recovering && (
        <p className="vd-voice vd-signin__note">
          {creating
            ? "An account holds your seat and nothing else — you can play without one."
            : "You only need an account to hold a seat or reach the console."}
        </p>
      )}
    </div>
  );
}

/**
 * The `#/signin` surface the header and the gate footer link to. Signing in
 * lands you back at the council rather than leaving you on a dead page.
 */
export function SignInPage() {
  return (
    <div className="vd-shell">
      <div className="vd-signin-page">
        <a className="vd-pill" href="#/">
          <ArrowLeft size={11} /> Back to council
        </a>
        <SignInCard onDone={() => { window.location.hash = "#/"; }} />
      </div>
    </div>
  );
}

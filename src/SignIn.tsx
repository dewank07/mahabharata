import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { KeyRound, Loader2, Sparkles } from "lucide-react";

/**
 * Sign-in surface. Google is the real path; the email + password form only
 * appears when the deployment has DEV_PASSWORD_AUTH set, which is how the app
 * stays usable before a Google OAuth client exists.
 */
export function SignInCard({
  passwordAuthEnabled,
}: {
  passwordAuthEnabled: boolean;
}) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await signIn("password", { email, password, flow });
    } catch (e: any) {
      // Convex Auth deliberately keeps these vague; say something actionable.
      setErr(
        flow === "signUp"
          ? "Could not create that account. The password must be at least 8 characters, and the email may already be registered."
          : "Could not sign in. Check the email and password, or create the account first.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="btn-gold-hover billing-google"
        onClick={() => void signIn("google")}
      >
        <Sparkles size={16} /> Sign in with Google
      </button>

      {passwordAuthEnabled && (
        <div className="signin-alt">
          <div className="signin-divider">
            <span>or use an email &amp; password</span>
          </div>

          <div className="signin-tabs">
            <button
              className={`rules-theme-btn ${flow === "signIn" ? "is-on" : ""}`}
              onClick={() => {
                setFlow("signIn");
                setErr("");
              }}
            >
              Sign in
            </button>
            <button
              className={`rules-theme-btn ${flow === "signUp" ? "is-on" : ""}`}
              onClick={() => {
                setFlow("signUp");
                setErr("");
              }}
            >
              Create account
            </button>
          </div>

          <label className="field-label" htmlFor="si-email">
            Email
          </label>
          <input
            id="si-email"
            className="field-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="field-label" htmlFor="si-pass">
            Password
          </label>
          <input
            id="si-pass"
            className="field-input"
            type="password"
            autoComplete={flow === "signUp" ? "new-password" : "current-password"}
            placeholder={flow === "signUp" ? "at least 8 characters" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && email && password.length >= 8) void submit();
            }}
          />

          <button
            className="btn-gold-hover billing-btn"
            disabled={busy || !email || password.length < 8}
            onClick={() => void submit()}
          >
            {busy ? (
              <Loader2 size={15} className="billing-spin" />
            ) : (
              <KeyRound size={15} />
            )}{" "}
            {flow === "signUp" ? "Create account & sign in" : "Sign in"}
          </button>

          {err && <p className="billing-msg">{err}</p>}

          <p className="rules-note">
            Email sign-in is on because <code>DEV_PASSWORD_AUTH</code> is set on
            this deployment. Unset it to leave Google as the only way in.
          </p>
        </div>
      )}
    </>
  );
}

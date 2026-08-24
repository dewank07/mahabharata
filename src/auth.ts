/* ============================================================================
   The app's whole auth surface, in one file.

   Every component talks to `useAuth()` and nothing else — no screen imports
   `@convex-dev/auth/react` directly. That keeps the provider swappable: moving
   to Clerk, Auth0 or anything else is a rewrite of this file and nowhere else.
   The shape below is deliberately provider-neutral: email + password in, a
   plain `{ ok }` result out, no thrown errors for the caller to decode.
   ========================================================================== */

import { useCallback } from "react";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

/**
 * The provider that has to wrap the app. Re-exported from here so `main.tsx`
 * never names the vendor either — this file stays the only one that does.
 */
export const AuthProvider = ConvexAuthProvider;

/** Sign-in and account creation are the same form with two intents. */
export type AuthFlow = "signIn" | "signUp";

/** How many digits the reset code has. Kept beside the form that types it. */
export const RESET_CODE_LENGTH = 6;

export type AuthResult = { ok: true } | { ok: false; error: string };

/** Kept here rather than in the form so the rule has one home. */
export const MIN_PASSWORD = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Use at least ${MIN_PASSWORD} characters.`;
  }
  return null;
}

export function emailProblem(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "That does not look like an email address.";
  }
  return null;
}

/**
 * Providers keep their failures deliberately vague so an attacker cannot probe
 * which half was wrong. Say something a real person can act on instead, without
 * leaking whether the account exists.
 */
function readableError(flow: AuthFlow): string {
  return flow === "signUp"
    ? `Could not create that account. The password needs ${MIN_PASSWORD} or more characters, and the email may already be registered.`
    : "Could not sign in. Check the email and password — or create the account first.";
}

export type Auth = {
  /** True until the provider has decided whether we hold a session. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Both take a trimmed, lower-cased email; neither throws. */
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  createAccount: (email: string, password: string) => Promise<AuthResult>;
  /** Step one of a reset: mail a code to the address. */
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  /** Step two: spend the code, set the new password, and land signed in. */
  completePasswordReset: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

export function useAuth(): Auth {
  const { signIn, signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();

  const withEmail = useCallback(
    async (flow: AuthFlow, email: string, password: string): Promise<AuthResult> => {
      const local = emailProblem(email) ?? passwordProblem(password);
      if (local) return { ok: false, error: local };
      try {
        // Normalising here means one address can never become two accounts,
        // and matches how seats are looked up on the server.
        await signIn("password", {
          email: email.trim().toLowerCase(),
          password,
          flow,
        });
        return { ok: true };
      } catch {
        return { ok: false, error: readableError(flow) };
      }
    },
    [signIn],
  );

  // Step one. Deliberately reports success even for an address with no
  // account: telling a stranger which emails are registered is a gift to
  // someone enumerating them. The person who owns the inbox learns the truth.
  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthResult> => {
      const bad = emailProblem(email);
      if (bad) return { ok: false, error: bad };
      try {
        await signIn("password", {
          email: email.trim().toLowerCase(),
          flow: "reset",
        });
        return { ok: true };
      } catch {
        // A real failure here is the deployment having no mail key, which the
        // person cannot fix and should not be left guessing about.
        return {
          ok: false,
          error: "Could not send the code. Email may not be set up on this deployment.",
        };
      }
    },
    [signIn],
  );

  const completePasswordReset = useCallback(
    async (email: string, code: string, newPassword: string): Promise<AuthResult> => {
      const bad = passwordProblem(newPassword);
      if (bad) return { ok: false, error: bad };
      try {
        await signIn("password", {
          email: email.trim().toLowerCase(),
          code: code.trim(),
          newPassword,
          flow: "reset-verification",
        });
        return { ok: true };
      } catch {
        return {
          ok: false,
          error: "That code was wrong or has expired. Ask for a new one.",
        };
      }
    },
    [signIn],
  );

  return {
    isLoading,
    isAuthenticated,
    requestPasswordReset,
    completePasswordReset,
    signInWithEmail: useCallback(
      (email, password) => withEmail("signIn", email, password),
      [withEmail],
    ),
    createAccount: useCallback(
      (email, password) => withEmail("signUp", email, password),
      [withEmail],
    ),
    signOut: useCallback(async () => {
      await signOut();
    }, [signOut]),
  };
}

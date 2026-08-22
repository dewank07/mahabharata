import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * Sign-in is optional for playing — a guest can still join a room with a name.
 * It is required to hold a subscription seat, to buy one, or to reach the admin
 * console.
 *
 * Google needs three Convex env vars: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and
 * SITE_URL. See "Google sign-in setup" in the README.
 *
 * Email + password is additionally available when DEV_PASSWORD_AUTH is set on
 * the deployment. That exists so the app is usable before a Google OAuth client
 * has been created, and it is deliberately opt-in: leaving the variable unset
 * means production has exactly one way in. It is a real login rather than an
 * authorization bypass — admin rights and entitlements still come from the
 * account's email, so nothing downstream has to trust it differently.
 */
const passwordAuthEnabled = Boolean(process.env.DEV_PASSWORD_AUTH);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    ...(passwordAuthEnabled
      ? [
          Password({
            // Normalize the address so seat lookups (which are lower-cased)
            // match, and so one email cannot be registered twice in two cases.
            profile(params) {
              return { email: String(params.email ?? "").trim().toLowerCase() };
            },
          }),
        ]
      : []),
  ],
});

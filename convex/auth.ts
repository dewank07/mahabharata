import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { PasswordResetEmail } from "./passwordReset";

/**
 * Sign-in is optional for playing — a guest can still join a room with a name.
 * It is required to hold a subscription seat, to buy one, or to reach the admin
 * console.
 *
 * Email + password is the only way in, on purpose. There is no OAuth provider
 * to register, no client id or secret to keep, no consent screen to maintain
 * and no third party in the sign-in path — a deployment is usable the moment
 * it exists. Admin rights and entitlements come from the account's email, so
 * nothing downstream ever cared which provider issued it.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Normalize the address so seat lookups (which are lower-cased) match,
      // and so one email cannot be registered twice in two cases.
      profile(params) {
        return { email: String(params.email ?? "").trim().toLowerCase() };
      },
      // Unlocks the "reset" and "reset-verification" flows. Needs a Resend key
      // on the deployment to actually deliver; see convex/email.ts.
      reset: PasswordResetEmail,
    }),
  ],

  callbacks: {
    /**
     * Onboarding mail. Runs inside the sign-in transaction, so it can only
     * schedule the send — mutations cannot reach the network.
     *
     * `existingUserId` is null only when the account is genuinely new, which
     * keeps every later sign-in from re-welcoming the same person.
     */
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return;
      const user = await ctx.db.get(userId);
      const email = (user as { email?: string } | null)?.email;
      if (!email) return;
      await ctx.scheduler.runAfter(0, internal.email.sendWelcome, { email });
    },
  },
});

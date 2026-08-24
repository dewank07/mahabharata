/* ============================================================================
   "I forgot my password" — the email side of it.

   Convex Auth drives the whole flow through the Password provider's two extra
   flows: `reset` asks for a code, `reset-verification` spends it and sets the
   new password. All this file has to provide is how the code is made and how
   it reaches the person.
   ========================================================================== */

import { Email } from "@convex-dev/auth/providers/Email";
import { passwordResetEmail, sendEmail } from "./email";

/** Long enough to be typed from a phone, short enough to be read aloud. */
const CODE_DIGITS = 6;

/** A code is only useful for as long as someone is sitting at the screen. */
const EXPIRY_MINUTES = 15;

/**
 * A uniformly random numeric code. `Math.random()` is not acceptable for
 * anything that guards an account, and the naive `% 1000000` is biased, so
 * reject the tail of the range instead and draw again.
 */
function numericCode(digits: number): string {
  const range = 10 ** digits;
  const limit = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  let draw: number;
  do {
    crypto.getRandomValues(buf);
    draw = buf[0];
  } while (draw >= limit);
  return String(draw % range).padStart(digits, "0");
}

/**
 * Six digits is well under the 24 characters Convex Auth treats as secure on
 * their own — which is exactly why the client must send the original email
 * alongside the code. `Email()`'s default `authorize` enforces that, so the
 * code alone is worthless to anyone who intercepts it.
 */
export const PasswordResetEmail = Email({
  id: "password-reset",
  maxAge: EXPIRY_MINUTES * 60,
  async generateVerificationToken() {
    return numericCode(CODE_DIGITS);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const { subject, html, text } = passwordResetEmail(token, EXPIRY_MINUTES);
    const sent = await sendEmail({ to: email, subject, html, text });
    if (!sent) {
      // Unlike the welcome note, silence here strands the person: they would
      // sit waiting for a code that was never going to arrive.
      throw new Error(
        "Password reset is unavailable: this deployment has no RESEND_API_KEY set.",
      );
    }
  },
});

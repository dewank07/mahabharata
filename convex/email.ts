/* ============================================================================
   Outbound email, via Resend.

   Spoken to over plain `fetch` rather than the `resend` SDK: one less
   dependency, and the REST call is three lines. `fetch` is available in the
   default Convex runtime, so nothing here needs "use node".

   Two things get sent today — a welcome note when an account is created, and a
   password reset code. Both are addressed to someone who just acted, so there
   is no list, no unsubscribe machinery and no scheduling to manage.

   Env vars, all set on the Convex deployment (`npx convex env set NAME value`):
     RESEND_API_KEY  required to send at all. Unset = email quietly disabled.
     EMAIL_FROM      "Name <you@your-domain.com>". Must be a domain you have
                     verified in Resend, or Resend refuses the send. Defaults to
                     Resend's own onboarding@resend.dev, which only delivers to
                     the address that owns the Resend account — fine for testing.
     SITE_URL        where the links in the emails point.
   ========================================================================== */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend's shared sender. Only delivers to the Resend account's own address. */
const FALLBACK_FROM = "Decevia <onboarding@resend.dev>";

export function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:5173";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Sends one email. Throws when Resend rejects it, so a caller that must not
 * fail silently (the password reset) surfaces the problem to the person
 * waiting. Returns `false` — without throwing — when email is not configured
 * at all, which is a legitimate state for a deployment that has not set a key
 * yet; callers decide whether that is fatal.
 */
export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(
      `[email] RESEND_API_KEY is not set — skipping "${args.subject}" to ${args.to}.`,
    );
    return false;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? FALLBACK_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  if (!res.ok) {
    // Resend returns a JSON body explaining the refusal — an unverified
    // sending domain is by far the most common one.
    const detail = await res.text();
    throw new Error(`Resend refused the send (${res.status}): ${detail}`);
  }
  return true;
}

/* ------------------------------- templates ------------------------------- */

/**
 * One shell for every email. Deliberately plain and light: mail clients strip
 * most CSS, ignore custom fonts and half of them force their own dark mode, so
 * the board's palette is not worth fighting for here. Serif and generous
 * spacing carry enough of the voice.
 */
function shell(title: string, body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#231f1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #ded7c8">
    <tr><td style="padding:28px 28px 8px">
      <div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#8a7f6b">Decevia</div>
      <h1 style="margin:14px 0 0;font-size:24px;font-weight:500;line-height:1.2">${title}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#3d372f">${body}</td></tr>
  </table>
  <p style="max-width:520px;margin:14px auto 0;font-size:12px;line-height:1.5;color:#8a7f6b">
    You are receiving this because someone used this address at
    <a href="${siteUrl()}" style="color:#8a7f6b">${siteUrl()}</a>.
  </p>
</body></html>`;
}

export function welcomeEmail(): { subject: string; html: string; text: string } {
  const subject = "Your seat at the table";
  const html = shell(
    "Welcome to Decevia",
    `<p style="margin:0 0 14px">Where friends become foes. Convene a council, share the
     four-letter code, and find out who at your table is lying.</p>
     <p style="margin:0 0 14px">Pick a world to play it in — Indian Mythology, Medieval
     Kingdom, Egyptian Gods, Greek Mythology or the Maratha Empire. Same game of trust,
     different faces around the table.</p>
     <p style="margin:0 0 20px">An account only holds your seat on a plan. Guests can
     always join a room with nothing but a name.</p>
     <p style="margin:0"><a href="${siteUrl()}"
       style="display:inline-block;padding:12px 20px;background:#231f1a;color:#f2ece0;text-decoration:none;font-size:13px;letter-spacing:.12em;text-transform:uppercase">Take your seat</a></p>`,
  );
  const text = [
    "Welcome to Decevia — where friends become foes.",
    "",
    "Convene a council, share the four-letter code, and find out who at your",
    "table is lying. Five worlds to play it in: Indian Mythology, Medieval",
    "Kingdom, Egyptian Gods, Greek Mythology, the Maratha Empire.",
    "",
    "An account only holds your seat on a plan — guests can join with just a name.",
    "",
    `Take your seat: ${siteUrl()}`,
  ].join("\n");
  return { subject, html, text };
}

export function passwordResetEmail(
  code: string,
  expiresMinutes: number,
): { subject: string; html: string; text: string } {
  const subject = `Your reset code: ${code}`;
  const html = shell(
    "Set a new password",
    `<p style="margin:0 0 18px">Enter this code on the sign-in screen to choose a new password.</p>
     <p style="margin:0 0 18px;font-family:'Courier New',monospace;font-size:32px;letter-spacing:.28em;color:#231f1a">${code}</p>
     <p style="margin:0 0 8px">It expires in ${expiresMinutes} minutes and can be used once.</p>
     <p style="margin:0;color:#8a7f6b;font-size:13px">If you did not ask for this, nothing has changed —
     ignore this email and your password stays as it was.</p>`,
  );
  const text = [
    "Set a new password.",
    "",
    `Your code is ${code}. Enter it on the sign-in screen to choose a new password.`,
    `It expires in ${expiresMinutes} minutes and can be used once.`,
    "",
    "If you did not ask for this, ignore this email — nothing has changed.",
  ].join("\n");
  return { subject, html, text };
}

/* -------------------------------- actions -------------------------------- */

/**
 * Scheduled by the auth callback when an account is first created. Kept as its
 * own action because the callback runs in a mutation, and mutations cannot
 * reach the network.
 *
 * A welcome note is not worth failing a sign-up over, so a send failure is
 * logged and swallowed: the account exists either way.
 */
export const sendWelcome = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const { subject, html, text } = welcomeEmail();
    try {
      await sendEmail({ to: email, subject, html, text });
    } catch (err) {
      console.error(`[email] welcome to ${email} failed:`, err);
    }
    return null;
  },
});

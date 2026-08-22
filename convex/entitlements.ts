// Who is allowed to use the paid content, and who is an admin.
//
// Everything here derives identity from `ctx.auth` — never from a client
// argument — so a tampered client cannot grant itself premium or admin.
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/** Seats included in one subscription — "a subscription for 7 people". */
export const DEFAULT_SEATS = 7;

/** Plan lengths, in days. */
export const PLAN_DAYS = { monthly: 30, yearly: 365 } as const;
export type Plan = keyof typeof PLAN_DAYS;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Cheap sanity check — real validation is the OAuth sign-in itself. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* --------------------------------- admin -------------------------------- */

/**
 * Admins come from the ADMIN_EMAILS Convex env var (comma-separated) so the
 * list can change without a redeploy. Falls back to the project owner.
 */
function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "dewank.r@amberstudent.com";
  return raw
    .split(",")
    .map(normalizeEmail)
    .filter((e) => e.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(normalizeEmail(email));
}

/* -------------------------------- identity ------------------------------- */

export async function signedInUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db.get(userId);
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const user = await signedInUser(ctx);
  if (!user) throw new Error("Sign in with Google first.");
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdminEmail(user.email)) throw new Error("Admins only.");
  return user;
}

/* ------------------------------ entitlement ----------------------------- */

export type Entitlement = {
  premium: boolean;
  /** Max players allowed in a premium room. 0 when not premium. */
  seats: number;
  subscriptionId: Id<"subscriptions"> | null;
  expiresAt: number | null;
  ownerEmail: string | null;
};

export const FREE_ENTITLEMENT: Entitlement = {
  premium: false,
  seats: 0,
  subscriptionId: null,
  expiresAt: null,
  ownerEmail: null,
};

/**
 * Does this email hold a live seat? A seat is live only while its subscription
 * is `active` and has not passed `expiresAt`, so a lapsed plan silently stops
 * unlocking content without any cron sweeping the table.
 */
export async function entitlementForEmail(
  ctx: Ctx,
  email: string | null | undefined,
): Promise<Entitlement> {
  if (!email) return FREE_ENTITLEMENT;
  const seatRows = await ctx.db
    .query("seats")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(email)))
    .collect();
  const now = Date.now();
  for (const seat of seatRows) {
    const sub = await ctx.db.get(seat.subscriptionId);
    if (!sub || sub.status !== "active" || sub.expiresAt <= now) continue;
    return {
      premium: true,
      seats: sub.seats,
      subscriptionId: sub._id,
      expiresAt: sub.expiresAt,
      ownerEmail: sub.ownerEmail,
    };
  }
  return FREE_ENTITLEMENT;
}

export type CallerEntitlement = Entitlement & {
  signedIn: boolean;
  email: string | null;
  isAdmin: boolean;
};

export async function callerEntitlement(ctx: Ctx): Promise<CallerEntitlement> {
  const user = await signedInUser(ctx);
  const ent = await entitlementForEmail(ctx, user?.email ?? null);
  return {
    ...ent,
    signedIn: user !== null,
    email: user?.email ?? null,
    isAdmin: isAdminEmail(user?.email),
  };
}

/**
 * A room's entitlement is its host's. Recomputed rather than snapshotted, so
 * revoking a subscription takes effect on the next action in every open room.
 */
export async function roomEntitlement(
  ctx: Ctx,
  room: Doc<"rooms">,
): Promise<Entitlement> {
  if (!room.hostUserId) return FREE_ENTITLEMENT;
  const owner = await ctx.db.get(room.hostUserId);
  return await entitlementForEmail(ctx, owner?.email ?? null);
}

/* -------------------------------- pricing ------------------------------- */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type Pricing = {
  monthlyInr: number;
  yearlyInr: number;
  seats: number;
  upiVpa: string | null;
  payeeName: string;
  /** Optional override: a hosted image of your own static payment QR. */
  qrImageUrl: string | null;
};

export function pricing(): Pricing {
  return {
    monthlyInr: intEnv("PRICE_MONTHLY_INR", 299),
    yearlyInr: intEnv("PRICE_YEARLY_INR", 2499),
    seats: intEnv("SUBSCRIPTION_SEATS", DEFAULT_SEATS),
    upiVpa: process.env.UPI_VPA ?? null,
    payeeName: process.env.UPI_PAYEE_NAME ?? "Dharmayuddha",
    qrImageUrl: process.env.PAYMENT_QR_URL ?? null,
  };
}

/** Server-side price for a plan. Never trust an amount sent by the client. */
export function priceFor(plan: Plan): number {
  const p = pricing();
  return plan === "yearly" ? p.yearlyInr : p.monthlyInr;
}

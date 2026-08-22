// Subscriptions, purchase requests, and the admin console's data layer.
//
// Payment happens out of band: the buyer scans a UPI QR, pays, and records the
// transaction reference in an order. An admin then approves it, which is what
// actually mints the subscription and its seats. Nothing here talks to a payment
// gateway, and no client-supplied amount or email is ever trusted for access.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import {
  callerEntitlement, entitlementForEmail, requireAdmin, requireUser,
  signedInUser, isAdminEmail, normalizeEmail, looksLikeEmail,
  pricing, priceFor, PLAN_DAYS, type Plan,
} from "./entitlements";
import {
  PREMIUM_OPT_KEYS, PREMIUM_OPT_LABELS, FREE_THEME_IDS, FREE_OPT_KEYS,
} from "./logic";

const DAY_MS = 24 * 60 * 60 * 1000;
const planValidator = v.union(v.literal("monthly"), v.literal("yearly"));

/* -------------------------------- queries ------------------------------- */

/** Who am I, what can I use, and am I an admin? Drives the whole client. */
export const viewer = query({
  args: {},
  handler: async (ctx) => {
    const user = await signedInUser(ctx);
    const ent = await callerEntitlement(ctx);
    return {
      /** Whether the email+password form should be offered alongside Google. */
      passwordAuthEnabled: Boolean(process.env.DEV_PASSWORD_AUTH),
      signedIn: ent.signedIn,
      isAdmin: ent.isAdmin,
      email: ent.email,
      name: user?.name ?? null,
      image: user?.image ?? null,
      premium: ent.premium,
      seats: ent.seats,
      expiresAt: ent.expiresAt,
      /** Set when my seat comes from someone else's plan. */
      ownerEmail: ent.ownerEmail,
      iOwnPlan: ent.ownerEmail != null && ent.email != null
        && normalizeEmail(ent.ownerEmail) === normalizeEmail(ent.email),
    };
  },
});

/** Public: prices, seat count, and where to send the money. */
export const paymentConfig = query({
  args: {},
  handler: async () => {
    const p = pricing();
    return {
      ...p,
      freeThemeIds: FREE_THEME_IDS,
      freeOptKeys: FREE_OPT_KEYS,
      premiumOptKeys: PREMIUM_OPT_KEYS,
      premiumOptLabels: PREMIUM_OPT_LABELS,
    };
  },
});

/** My own purchase requests, newest first. */
export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await signedInUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** The seats on the plan I hold, so a buyer can see who is covered. */
export const mySubscription = query({
  args: {},
  handler: async (ctx) => {
    const ent = await callerEntitlement(ctx);
    if (!ent.subscriptionId) return null;
    const sub = await ctx.db.get(ent.subscriptionId);
    if (!sub) return null;
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", sub._id))
      .collect();
    return {
      _id: sub._id,
      plan: sub.plan,
      seats: sub.seats,
      status: sub.status,
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      ownerEmail: sub.ownerEmail,
      members: seats.map((s) => s.email).sort(),
      iAmOwner: ent.email != null
        && normalizeEmail(sub.ownerEmail) === normalizeEmail(ent.email),
    };
  },
});

/* ---------------------------- buyer mutations --------------------------- */

/**
 * Record a purchase request after paying by QR. The amount is taken from the
 * server's own price table, never from the client.
 */
export const submitOrder = mutation({
  args: {
    plan: planValidator,
    memberEmails: v.array(v.string()),
    paymentRef: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { plan, memberEmails, paymentRef, note }) => {
    const user = await requireUser(ctx);
    if (!user.email) throw new Error("Your Google account has no email.");
    const ref = paymentRef.trim();
    if (ref.length < 4) {
      throw new Error("Paste the UPI transaction reference from your payment.");
    }

    const existing = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (existing.some((o) => o.status === "pending")) {
      throw new Error("You already have a request awaiting review.");
    }

    const p = pricing();
    // The buyer's own email always holds a seat, whether they listed it or not.
    const emails = dedupeEmails([user.email, ...memberEmails]);
    for (const e of emails) {
      if (!looksLikeEmail(e)) throw new Error(`"${e}" is not a valid email.`);
    }
    if (emails.length > p.seats) {
      throw new Error(
        `A plan covers ${p.seats} people — you listed ${emails.length}.`,
      );
    }

    return await ctx.db.insert("orders", {
      userId: user._id,
      email: normalizeEmail(user.email),
      name: user.name ?? normalizeEmail(user.email),
      plan,
      seats: p.seats,
      amountInr: priceFor(plan),
      memberEmails: emails,
      paymentRef: ref,
      note: note?.trim() || undefined,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const cancelMyOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const user = await requireUser(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("No such request.");
    if (order.userId !== user._id) throw new Error("That is not your request.");
    if (order.status !== "pending") {
      throw new Error("That request has already been reviewed.");
    }
    await ctx.db.patch(orderId, { status: "cancelled" });
  },
});

/** Update the covered emails on a plan I own. */
export const updateMyMembers = mutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const user = await requireUser(ctx);
    if (!user.email) throw new Error("Your Google account has no email.");
    const ent = await entitlementForEmail(ctx, user.email);
    if (!ent.subscriptionId) throw new Error("You have no active plan.");
    const sub = await ctx.db.get(ent.subscriptionId);
    if (!sub) throw new Error("You have no active plan.");
    if (normalizeEmail(sub.ownerEmail) !== normalizeEmail(user.email)) {
      throw new Error("Only the person who bought the plan can change its members.");
    }
    // The owner can never remove themselves from their own plan.
    await replaceSeats(ctx, sub._id, [user.email, ...emails], sub.seats);
  },
});

/* ---------------------------- admin: reading ---------------------------- */

export const adminOrders = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("orders").collect();
    const filtered = status ? rows.filter((o) => o.status === status) : rows;
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const adminSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const subs = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    const out = [];
    for (const sub of subs) {
      const seats = await ctx.db
        .query("seats")
        .withIndex("by_subscription", (q) => q.eq("subscriptionId", sub._id))
        .collect();
      out.push({
        _id: sub._id,
        ownerEmail: sub.ownerEmail,
        plan: sub.plan,
        seats: sub.seats,
        status: sub.status,
        startedAt: sub.startedAt,
        expiresAt: sub.expiresAt,
        adminNote: sub.adminNote ?? null,
        members: seats.map((s) => s.email).sort(),
        /** Derived, so a lapsed plan reads correctly without a cron job. */
        live: sub.status === "active" && sub.expiresAt > now,
      });
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
  },
});

export const adminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [orders, subs, users, rooms] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("rooms").collect(),
    ]);
    const now = Date.now();
    const live = subs.filter((s) => s.status === "active" && s.expiresAt > now);
    return {
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      approvedOrders: orders.filter((o) => o.status === "approved").length,
      liveSubscriptions: live.length,
      seatsCovered: live.reduce((acc, s) => acc + s.seats, 0),
      revenueInr: orders
        .filter((o) => o.status === "approved")
        .reduce((acc, o) => acc + o.amountInr, 0),
      users: users.length,
      openRooms: rooms.length,
    };
  },
});

export const adminUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const out = [];
    for (const u of users) {
      const ent = await entitlementForEmail(ctx, u.email ?? null);
      out.push({
        _id: u._id,
        email: u.email ?? null,
        name: u.name ?? null,
        image: u.image ?? null,
        joinedAt: u._creationTime,
        premium: ent.premium,
        expiresAt: ent.expiresAt,
        isAdmin: isAdminEmail(u.email),
      });
    }
    return out.sort((a, b) => b.joinedAt - a.joinedAt);
  },
});

/* ---------------------------- admin: writing ---------------------------- */

/**
 * Approve a paid order: mint (or extend) the buyer's subscription and write one
 * seat row per covered email.
 */
export const adminApproveOrder = mutation({
  args: {
    orderId: v.id("orders"),
    /** Defaults to the plan's own length. */
    days: v.optional(v.number()),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, { orderId, days, adminNote }) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("No such request.");
    if (order.status !== "pending") {
      throw new Error(`That request is already ${order.status}.`);
    }

    const span = (days && days > 0 ? days : PLAN_DAYS[order.plan as Plan]) * DAY_MS;
    const now = Date.now();

    // Extend an existing live plan rather than stacking a second one.
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", order.userId))
      .collect();
    const live = existing.find((s) => s.status === "active" && s.expiresAt > now);

    let subscriptionId: Id<"subscriptions">;
    if (live) {
      subscriptionId = live._id;
      await ctx.db.patch(live._id, {
        plan: order.plan,
        seats: order.seats,
        expiresAt: live.expiresAt + span,
        orderId: order._id,
        adminNote: adminNote?.trim() || live.adminNote,
      });
    } else {
      subscriptionId = await ctx.db.insert("subscriptions", {
        ownerUserId: order.userId,
        ownerEmail: order.email,
        plan: order.plan,
        seats: order.seats,
        status: "active",
        startedAt: now,
        expiresAt: now + span,
        orderId: order._id,
        adminNote: adminNote?.trim() || undefined,
      });
    }

    await replaceSeats(ctx, subscriptionId, order.memberEmails, order.seats);
    await ctx.db.patch(orderId, {
      status: "approved",
      reviewedAt: now,
      reviewedByEmail: admin.email ? normalizeEmail(admin.email) : undefined,
      adminNote: adminNote?.trim() || undefined,
    });
    return subscriptionId;
  },
});

export const adminRejectOrder = mutation({
  args: { orderId: v.id("orders"), adminNote: v.optional(v.string()) },
  handler: async (ctx, { orderId, adminNote }) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("No such request.");
    if (order.status !== "pending") {
      throw new Error(`That request is already ${order.status}.`);
    }
    await ctx.db.patch(orderId, {
      status: "rejected",
      reviewedAt: Date.now(),
      reviewedByEmail: admin.email ? normalizeEmail(admin.email) : undefined,
      adminNote: adminNote?.trim() || undefined,
    });
  },
});

/** Hand someone a plan directly — comps, testing, or a payment taken offline. */
export const adminGrantSubscription = mutation({
  args: {
    email: v.string(),
    plan: planValidator,
    days: v.optional(v.number()),
    seats: v.optional(v.number()),
    memberEmails: v.optional(v.array(v.string())),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, { email, plan, days, seats, memberEmails, adminNote }) => {
    await requireAdmin(ctx);
    const owner = normalizeEmail(email);
    if (!looksLikeEmail(owner)) throw new Error(`"${email}" is not a valid email.`);

    // The account only has to exist for the owner to sign in later; the seat is
    // keyed on email, so granting ahead of their first sign-in works fine.
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", owner))
      .unique();
    if (!user) {
      throw new Error(
        `${owner} has never signed in. Ask them to sign in with Google once, then grant it.`,
      );
    }

    const seatCount = seats && seats > 0 ? seats : pricing().seats;
    const span = (days && days > 0 ? days : PLAN_DAYS[plan]) * DAY_MS;
    const now = Date.now();
    const subscriptionId = await ctx.db.insert("subscriptions", {
      ownerUserId: user._id,
      ownerEmail: owner,
      plan,
      seats: seatCount,
      status: "active",
      startedAt: now,
      expiresAt: now + span,
      adminNote: adminNote?.trim() || "granted by admin",
    });
    await replaceSeats(ctx, subscriptionId, [owner, ...(memberEmails ?? [])], seatCount);
    return subscriptionId;
  },
});

export const adminSetSeats = mutation({
  args: { subscriptionId: v.id("subscriptions"), emails: v.array(v.string()) },
  handler: async (ctx, { subscriptionId, emails }) => {
    await requireAdmin(ctx);
    const sub = await ctx.db.get(subscriptionId);
    if (!sub) throw new Error("No such subscription.");
    await replaceSeats(ctx, subscriptionId, [sub.ownerEmail, ...emails], sub.seats);
  },
});

export const adminSetStatus = mutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    status: v.union(v.literal("active"), v.literal("revoked"), v.literal("expired")),
    /** Optional new expiry, e.g. to extend a plan by hand. */
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { subscriptionId, status, expiresAt }) => {
    await requireAdmin(ctx);
    const sub = await ctx.db.get(subscriptionId);
    if (!sub) throw new Error("No such subscription.");
    await ctx.db.patch(subscriptionId, {
      status,
      ...(expiresAt ? { expiresAt } : {}),
    });
  },
});

export const adminDeleteSubscription = mutation({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, { subscriptionId }) => {
    await requireAdmin(ctx);
    const seats = await ctx.db
      .query("seats")
      .withIndex("by_subscription", (q) => q.eq("subscriptionId", subscriptionId))
      .collect();
    for (const s of seats) await ctx.db.delete(s._id);
    await ctx.db.delete(subscriptionId);
  },
});

/* -------------------------------- helpers ------------------------------- */

function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const e = normalizeEmail(raw);
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/**
 * Rewrite a subscription's seat rows. Trimmed to the plan's seat count so a
 * hand-edited member list can never quietly cover more people than was paid for.
 */
async function replaceSeats(
  ctx: MutationCtx,
  subscriptionId: Id<"subscriptions">,
  emails: string[],
  seatCount: number,
) {
  const wanted = dedupeEmails(emails).slice(0, seatCount);
  for (const e of wanted) {
    if (!looksLikeEmail(e)) throw new Error(`"${e}" is not a valid email.`);
  }
  const current = await ctx.db
    .query("seats")
    .withIndex("by_subscription", (q) => q.eq("subscriptionId", subscriptionId))
    .collect();
  for (const row of current) await ctx.db.delete(row._id);
  for (const email of wanted) {
    await ctx.db.insert("seats", { subscriptionId, email });
  }
}

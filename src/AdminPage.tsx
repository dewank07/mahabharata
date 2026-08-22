import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BadgeCheck, Ban, Check, Clock, Crown, Gift, Loader2, LogOut, RefreshCw,
  ScrollText, Shield, Trash2, Users, X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { SignInCard } from "./SignIn";

const INR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

type Tab = "orders" | "subs" | "users" | "grant";

export default function AdminPage() {
  const { signOut } = useAuthActions();
  const viewer = useQuery(api.billing.viewer, {});
  const [tab, setTab] = useState<Tab>("orders");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (viewer === undefined) {
    return (
      <div className="rules-page">
        <div className="billing-center">
          <Loader2 size={26} className="billing-spin" />
        </div>
      </div>
    );
  }

  if (!viewer.signedIn) {
    return (
      <div className="rules-page">
        <header className="rules-hero">
          <a className="rules-back" href="#/">← Back to council</a>
          <p className="rules-kicker"><Shield size={14} /> Admin</p>
          <h1>Admin console</h1>
          <p className="rules-lede">Sign in to continue.</p>
        </header>
        <section className="rules-section">
          <SignInCard passwordAuthEnabled={viewer.passwordAuthEnabled} />
        </section>
      </div>
    );
  }

  // Not an admin: say so plainly rather than pretending the page does not exist.
  if (!viewer.isAdmin) {
    return (
      <div className="rules-page">
        <header className="rules-hero">
          <a className="rules-back" href="#/">← Back to council</a>
          <p className="rules-kicker"><Shield size={14} /> Admin</p>
          <h1>Not your console</h1>
          <p className="rules-lede">
            <strong>{viewer.email}</strong> is not an admin on this deployment.
            Admin emails come from the <code>ADMIN_EMAILS</code> Convex
            environment variable.
          </p>
        </header>
        <section className="rules-section">
          <button className="btn-ghost-hover billing-btn" onClick={() => void signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="rules-page">
      <header className="rules-hero">
        <a className="rules-back" href="#/">← Back to council</a>
        <p className="rules-kicker"><Shield size={14} /> Admin</p>
        <h1>Admin console</h1>
        <p className="rules-lede">
          Signed in as <strong>{viewer.email}</strong> ·{" "}
          <button className="billing-signout" onClick={() => void signOut()}>
            <LogOut size={12} /> sign out
          </button>
        </p>
      </header>

      <Overview />

      <div className="admin-tabs">
        {([
          ["orders", "Payment requests", Clock],
          ["subs", "Subscriptions", Crown],
          ["users", "Users", Users],
          ["grant", "Grant a plan", Gift],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            className={`rules-theme-btn ${tab === id ? "is-on" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {msg && <p className="billing-msg">{msg}</p>}

      {tab === "orders" && <Orders run={run} busy={busy} />}
      {tab === "subs" && <Subscriptions run={run} busy={busy} />}
      {tab === "users" && <UsersList />}
      {tab === "grant" && <Grant run={run} busy={busy} />}
    </div>
  );
}

/* ------------------------------- overview -------------------------------- */

function Overview() {
  const o = useQuery(api.billing.adminOverview, {});
  if (!o) return null;
  const tiles: Array<[string, string]> = [
    ["Pending", String(o.pendingOrders)],
    ["Live plans", String(o.liveSubscriptions)],
    ["Seats covered", String(o.seatsCovered)],
    ["Approved", String(o.approvedOrders)],
    ["Collected", INR(o.revenueInr)],
    ["Users", String(o.users)],
    ["Open rooms", String(o.openRooms)],
  ];
  return (
    <section className="rules-section">
      <div className="admin-tiles">
        {tiles.map(([label, value]) => (
          <div key={label} className="admin-tile">
            <span className="admin-tile__value">{value}</span>
            <span className="admin-tile__label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- payment requests ---------------------------- */

function Orders({
  run, busy,
}: {
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
  busy: boolean;
}) {
  const orders = useQuery(api.billing.adminOrders, {});
  const approve = useMutation(api.billing.adminApproveOrder);
  const reject = useMutation(api.billing.adminRejectOrder);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, string>>({});

  if (!orders) return <Loading />;
  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");

  return (
    <>
      <section className="rules-section">
        <h2><Clock size={18} /> Awaiting approval ({pending.length})</h2>
        {pending.length === 0 && (
          <p className="rules-note">Nothing to review right now.</p>
        )}
        {pending.map((o) => (
          <div key={o._id} className="admin-order">
            <div className="admin-order__head">
              <strong>{o.name}</strong>
              <span className="admin-order__email">{o.email}</span>
              <span className="billing-badge is-pending">
                {o.plan} · {INR(o.amountInr)}
              </span>
            </div>
            <dl className="admin-order__facts">
              <div><dt>Reference</dt><dd><code>{o.paymentRef}</code></dd></div>
              <div><dt>Submitted</dt><dd>{fmtWhen(o.createdAt)}</dd></div>
              <div><dt>Seats</dt><dd>{o.seats}</dd></div>
            </dl>
            <div className="admin-order__members">
              <span>Covers:</span>
              {o.memberEmails.map((e) => (
                <span key={e} className="rules-chip">{e}</span>
              ))}
            </div>
            {o.note && <p className="admin-order__note">Buyer says: “{o.note}”</p>}
            <div className="admin-order__actions">
              <input
                className="field-input admin-input"
                placeholder="days (blank = plan length)"
                value={days[o._id] ?? ""}
                onChange={(e) => setDays({ ...days, [o._id]: e.target.value })}
              />
              <input
                className="field-input admin-input"
                placeholder="note (optional)"
                value={notes[o._id] ?? ""}
                onChange={(e) => setNotes({ ...notes, [o._id]: e.target.value })}
              />
              <button
                className="btn-approve-hover admin-approve"
                disabled={busy}
                onClick={() =>
                  void run(() => {
                    const d = Number.parseInt(days[o._id] ?? "", 10);
                    return approve({
                      orderId: o._id,
                      days: Number.isFinite(d) && d > 0 ? d : undefined,
                      adminNote: notes[o._id]?.trim() || undefined,
                    });
                  }, `Activated ${o.seats} seats for ${o.email}.`)
                }
              >
                <Check size={16} /> Approve
              </button>
              <button
                className="btn-reject-hover admin-reject"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      reject({
                        orderId: o._id,
                        adminNote: notes[o._id]?.trim() || undefined,
                      }),
                    `Rejected ${o.email}'s request.`,
                  )
                }
              >
                <X size={16} /> Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className="rules-section">
          <h2><ScrollText size={18} /> History</h2>
          <div className="rules-map">
            <div className="rules-map__head">
              <span>When</span><span>Who</span><span>Status</span>
            </div>
            {done.map((o) => (
              <div key={o._id} className="rules-map__row">
                <span className="rules-map__base">{fmtDate(o.createdAt)}</span>
                <span className="rules-map__themed">
                  {o.email} · {o.plan} · {INR(o.amountInr)}
                </span>
                <span className={`billing-badge is-${o.status}`}>{o.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ---------------------------- subscriptions ------------------------------ */

function Subscriptions({
  run, busy,
}: {
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
  busy: boolean;
}) {
  const subs = useQuery(api.billing.adminSubscriptions, {});
  const setSeats = useMutation(api.billing.adminSetSeats);
  const setStatus = useMutation(api.billing.adminSetStatus);
  const del = useMutation(api.billing.adminDeleteSubscription);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!subs) return <Loading />;
  if (subs.length === 0) {
    return (
      <section className="rules-section">
        <p className="rules-note">No subscriptions yet.</p>
      </section>
    );
  }

  return (
    <section className="rules-section">
      <h2><Crown size={18} /> Subscriptions ({subs.length})</h2>
      {subs.map((s) => {
        const draft = drafts[s._id] ?? s.members.join(", ");
        return (
          <div key={s._id} className="admin-order">
            <div className="admin-order__head">
              <strong>{s.ownerEmail}</strong>
              <span className={`billing-badge is-${s.live ? "approved" : "rejected"}`}>
                {s.live ? "live" : s.status}
              </span>
              <span className="admin-order__email">
                {s.plan} · {s.seats} seats · expires {fmtDate(s.expiresAt)}
              </span>
            </div>
            {s.adminNote && (
              <p className="admin-order__note">Note: “{s.adminNote}”</p>
            )}
            <div className="admin-order__members">
              <span>{s.members.length}/{s.seats} seats used</span>
              {s.members.map((e) => (
                <span key={e} className="rules-chip">{e}</span>
              ))}
            </div>
            <label className="field-label">Covered emails (comma separated)</label>
            <input
              className="field-input"
              value={draft}
              onChange={(e) => setDrafts({ ...drafts, [s._id]: e.target.value })}
            />
            <div className="admin-order__actions">
              <button
                className="btn-ghost-hover admin-btn"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      setSeats({
                        subscriptionId: s._id,
                        emails: draft.split(",").map((e) => e.trim()).filter(Boolean),
                      }),
                    "Seats updated.",
                  )
                }
              >
                <Check size={15} /> Save seats
              </button>
              <button
                className="btn-ghost-hover admin-btn"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      setStatus({
                        subscriptionId: s._id,
                        status: "active",
                        expiresAt: Math.max(Date.now(), s.expiresAt) + 30 * 86400_000,
                      }),
                    "Extended by 30 days.",
                  )
                }
              >
                <RefreshCw size={15} /> +30 days
              </button>
              {s.status === "active" ? (
                <button
                  className="btn-reject-hover admin-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => setStatus({ subscriptionId: s._id, status: "revoked" }),
                      "Revoked.",
                    )
                  }
                >
                  <Ban size={15} /> Revoke
                </button>
              ) : (
                <button
                  className="btn-approve-hover admin-btn"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => setStatus({ subscriptionId: s._id, status: "active" }),
                      "Reactivated.",
                    )
                  }
                >
                  <BadgeCheck size={15} /> Reactivate
                </button>
              )}
              <button
                className="btn-reject-hover admin-btn"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Permanently delete ${s.ownerEmail}'s plan and all its seats?`)) return;
                  void run(
                    () => del({ subscriptionId: s._id }),
                    "Subscription deleted.",
                  );
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* -------------------------------- users ---------------------------------- */

function UsersList() {
  const users = useQuery(api.billing.adminUsers, {});
  if (!users) return <Loading />;
  return (
    <section className="rules-section">
      <h2><Users size={18} /> Users ({users.length})</h2>
      <div className="rules-map">
        <div className="rules-map__head">
          <span>Joined</span><span>Account</span><span>Tier</span>
        </div>
        {users.map((u) => (
          <div key={u._id} className="rules-map__row">
            <span className="rules-map__base">{fmtDate(u.joinedAt)}</span>
            <span className="rules-map__themed">
              {u.name ? `${u.name} · ` : ""}{u.email ?? "no email"}
              {u.isAdmin && " · admin"}
            </span>
            <span className={`billing-badge is-${u.premium ? "approved" : "pending"}`}>
              {u.premium ? "premium" : "free"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ manual grant ----------------------------- */

function Grant({
  run, busy,
}: {
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
  busy: boolean;
}) {
  const grant = useMutation(api.billing.adminGrantSubscription);
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [days, setDays] = useState("");
  const [seats, setSeats] = useState("");
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="rules-section">
      <h2><Gift size={18} /> Grant a plan directly</h2>
      <p className="rules-note">
        For comps, testing, or a payment you took outside the app. The person
        must have signed in with Google at least once so the account exists.
      </p>
      <label className="field-label">Owner email</label>
      <input
        className="field-input"
        placeholder="someone@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label className="field-label">Also cover (comma separated, optional)</label>
      <input
        className="field-input"
        placeholder="a@x.com, b@y.com"
        value={emails}
        onChange={(e) => setEmails(e.target.value)}
      />
      <div className="admin-order__actions">
        <select
          className="field-input admin-input"
          value={plan}
          onChange={(e) => setPlan(e.target.value as "monthly" | "yearly")}
        >
          <option value="monthly">monthly</option>
          <option value="yearly">yearly</option>
        </select>
        <input
          className="field-input admin-input"
          placeholder="days (optional)"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <input
          className="field-input admin-input"
          placeholder="seats (optional)"
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
        />
      </div>
      <label className="field-label">Note (optional)</label>
      <input
        className="field-input"
        placeholder="why this was granted"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="btn-gold-hover billing-btn"
        disabled={busy || email.trim().length < 5}
        onClick={() =>
          void run(() => {
            const d = Number.parseInt(days, 10);
            const st = Number.parseInt(seats, 10);
            return grant({
              email: email.trim(),
              plan,
              days: Number.isFinite(d) && d > 0 ? d : undefined,
              seats: Number.isFinite(st) && st > 0 ? st : undefined,
              memberEmails: emails.split(",").map((e) => e.trim()).filter(Boolean),
              adminNote: note.trim() || undefined,
            });
          }, `Granted a ${plan} plan to ${email.trim()}.`)
        }
      >
        <Gift size={15} /> Grant plan
      </button>
    </section>
  );
}

function Loading() {
  return (
    <div className="billing-center">
      <Loader2 size={22} className="billing-spin" />
    </div>
  );
}

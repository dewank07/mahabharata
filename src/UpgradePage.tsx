import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "./auth";
import { QRCodeSVG } from "qrcode.react";
import {
  BadgeCheck, Check, Clock, Crown, Loader2, LogOut, QrCode, ScrollText,
  Sparkles, Users, X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { SignInCard } from "./SignIn";

const INR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

/** UPI intent link. Any Indian banking app can scan this as a QR. */
function upiLink(vpa: string, payee: string, amount: number, note: string) {
  const q = new URLSearchParams({
    pa: vpa,
    pn: payee,
    am: String(amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${q.toString()}`;
}

export default function UpgradePage() {
  const { signOut } = useAuth();
  const viewer = useQuery(api.billing.viewer, {});
  const config = useQuery(api.billing.paymentConfig, {});
  const orders = useQuery(api.billing.myOrders, {});
  const sub = useQuery(api.billing.mySubscription, {});

  const mSubmit = useMutation(api.billing.submitOrder);
  const mCancel = useMutation(api.billing.cancelMyOrder);
  const mMembers = useMutation(api.billing.updateMyMembers);

  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [members, setMembers] = useState<string[]>([]);
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberDraft, setMemberDraft] = useState<string[]>([]);

  const seats = config?.seats ?? 7;

  // Six blanks beside the buyer's own (always-included) seat.
  useEffect(() => {
    setMembers((m) => (m.length === seats - 1 ? m : Array(seats - 1).fill("")));
  }, [seats]);

  useEffect(() => {
    if (sub?.members) setMemberDraft(sub.members.filter((e) => e !== sub.ownerEmail));
  }, [sub?.members, sub?.ownerEmail]);

  const amount = plan === "yearly" ? (config?.yearlyInr ?? 0) : (config?.monthlyInr ?? 0);
  const pendingOrder = (orders ?? []).find((o) => o.status === "pending");

  const qr = useMemo(() => {
    if (!config?.upiVpa || !amount) return null;
    return upiLink(
      config.upiVpa,
      config.payeeName,
      amount,
      `Decevia ${plan} plan`,
    );
  }, [config?.upiVpa, config?.payeeName, amount, plan]);

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

  /* ------------------------------ loading ------------------------------- */
  if (viewer === undefined || config === undefined) {
    return (
      <div className="rules-page">
        <div className="billing-center">
          <Loader2 size={26} className="billing-spin" />
        </div>
      </div>
    );
  }

  /* --------------------------- not signed in --------------------------- */
  if (!viewer.signedIn) {
    return (
      <div className="rules-page">
        <header className="rules-hero">
          <a className="rules-back" href="#/play">← Back to council</a>
          <p className="rules-kicker"><Crown size={14} /> Premium</p>
          <h1>Unlock the full war</h1>
          <p className="rules-lede">
            One plan covers <strong>{seats} people</strong>. Sign in to buy one, or
            to claim a seat someone bought for you.
          </p>
        </header>
        <section className="rules-section">
          <SignInCard />
        </section>
        <TierTable config={config} />
      </div>
    );
  }

  /* ----------------------------- signed in ----------------------------- */
  return (
    <div className="rules-page">
      <header className="rules-hero">
        <a className="rules-back" href="#/play">← Back to council</a>
        <p className="rules-kicker"><Crown size={14} /> Premium</p>
        <h1>{viewer.premium ? "Your plan" : "Unlock the full war"}</h1>
        <p className="rules-lede">
          Signed in as <strong>{viewer.email}</strong>
          {viewer.isAdmin && (
            <> · <a className="billing-link" href="#/admin">admin console</a></>
          )}
          {" · "}
          <button className="billing-signout" onClick={() => void signOut()}>
            <LogOut size={12} /> sign out
          </button>
        </p>
      </header>

      {/* ------------------------------ status ---------------------------- */}
      <section className="rules-section">
        <div
          className={`billing-status ${viewer.premium ? "is-live" : "is-free"}`}
        >
          {viewer.premium ? <BadgeCheck size={22} /> : <ScrollText size={22} />}
          <div>
            <strong>
              {viewer.premium ? "Premium active" : "Free tier"}
            </strong>
            <p>
              {viewer.premium ? (
                <>
                  Every character and expansion is unlocked
                  {viewer.expiresAt ? <> until {fmtDate(viewer.expiresAt)}</> : null}.
                  {!viewer.iOwnPlan && viewer.ownerEmail && (
                    <> You hold a seat on <strong>{viewer.ownerEmail}</strong>'s plan.</>
                  )}
                </>
              ) : (
                <>
                  You can play full games of base Avalon. Mordred, Oberon,
                  Guinevere, the lovers, the Lancelots, all three expansions and
                  the themed worlds need a plan.
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------- seat editor -------------------------- */}
      {sub && sub.iAmOwner && (
        <section className="rules-section">
          <h2><Users size={18} /> Who your plan covers</h2>
          <p className="rules-note">
            Your own seat ({sub.ownerEmail}) is permanent. Add up to{" "}
            {sub.seats - 1} more — they get premium in any room they host or join
            once they sign in with that email address.
          </p>
          <div className="billing-emails">
            {Array.from({ length: sub.seats - 1 }).map((_, i) => (
              <input
                key={i}
                className="field-input"
                placeholder={`teammate ${i + 1} — email`}
                value={memberDraft[i] ?? ""}
                onChange={(e) => {
                  const next = [...memberDraft];
                  next[i] = e.target.value;
                  setMemberDraft(next);
                }}
              />
            ))}
          </div>
          <button
            className="btn-gold-hover billing-btn"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  mMembers({
                    emails: memberDraft.map((e) => e.trim()).filter(Boolean),
                  }),
                "Seats updated.",
              )
            }
          >
            <Check size={15} /> Save seats
          </button>
        </section>
      )}

      {/* ---------------------------- buy flow --------------------------- */}
      {pendingOrder ? (
        <section className="rules-section">
          <h2><Clock size={18} /> Awaiting approval</h2>
          <div className="billing-status is-pending">
            <Clock size={22} />
            <div>
              <strong>
                {pendingOrder.plan === "yearly" ? "Yearly" : "Monthly"} plan ·{" "}
                {INR(pendingOrder.amountInr)}
              </strong>
              <p>
                Submitted {fmtDate(pendingOrder.createdAt)} with reference{" "}
                <code>{pendingOrder.paymentRef}</code>. An admin will verify the
                payment and activate your {pendingOrder.seats} seats.
              </p>
            </div>
          </div>
          <button
            className="btn-ghost-hover billing-btn"
            disabled={busy}
            onClick={() =>
              void run(() => mCancel({ orderId: pendingOrder._id }), "Request withdrawn.")
            }
          >
            <X size={15} /> Withdraw request
          </button>
        </section>
      ) : (
        <>
          <section className="rules-section">
            <h2><Crown size={18} /> Choose a plan</h2>
            <div className="billing-plans">
              {(["monthly", "yearly"] as const).map((k) => {
                const price = k === "yearly" ? config.yearlyInr : config.monthlyInr;
                const on = plan === k;
                return (
                  <button
                    key={k}
                    className={`billing-plan ${on ? "is-on" : ""}`}
                    onClick={() => setPlan(k)}
                  >
                    <span className="billing-plan__name">
                      {k === "yearly" ? "Yearly" : "Monthly"}
                    </span>
                    <span className="billing-plan__price">{INR(price)}</span>
                    <span className="billing-plan__sub">
                      {seats} seats · {k === "yearly" ? "365" : "30"} days
                    </span>
                    {k === "yearly" && (
                      <span className="billing-plan__save">
                        saves {INR(Math.max(0, config.monthlyInr * 12 - config.yearlyInr))}
                      </span>
                    )}
                    {on && <Check size={16} className="billing-plan__tick" />}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rules-section">
            <h2><QrCode size={18} /> Pay {INR(amount)}</h2>
            {config.qrImageUrl ? (
              <div className="billing-qr">
                <img src={config.qrImageUrl} alt="Payment QR code" />
                <p>Scan with any UPI app, then paste the reference below.</p>
              </div>
            ) : qr ? (
              <div className="billing-qr">
                <div className="billing-qr__frame">
                  <QRCodeSVG value={qr} size={188} level="M" includeMargin />
                </div>
                <p>
                  Scan with any UPI app to pay <strong>{INR(amount)}</strong> to{" "}
                  <strong>{config.upiVpa}</strong>, then paste the transaction
                  reference below.
                </p>
                <a className="billing-link" href={qr}>
                  Open in a UPI app on this device
                </a>
              </div>
            ) : (
              <div className="billing-warn">
                Payment is not configured yet. The admin needs to set{" "}
                <code>UPI_VPA</code> (or <code>PAYMENT_QR_URL</code>) in the
                Convex environment.
              </div>
            )}
          </section>

          <section className="rules-section">
            <h2><Users size={18} /> Who should it cover?</h2>
            <p className="rules-note">
              Your seat ({viewer.email}) is included automatically. List up to{" "}
              {seats - 1} teammates — they each need an account on that same
              email address to use it. You can change these later.
            </p>
            <div className="billing-emails">
              {members.map((val, i) => (
                <input
                  key={i}
                  className="field-input"
                  placeholder={`teammate ${i + 1} — email (optional)`}
                  value={val}
                  onChange={(e) => {
                    const next = [...members];
                    next[i] = e.target.value;
                    setMembers(next);
                  }}
                />
              ))}
            </div>

            <label className="field-label" htmlFor="payref">
              UPI transaction reference / UTR
            </label>
            <input
              id="payref"
              className="field-input"
              placeholder="e.g. 4179 1234 5678"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
            <label className="field-label" htmlFor="paynote">
              Anything the admin should know (optional)
            </label>
            <input
              id="paynote"
              className="field-input"
              placeholder="paid from a different number, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button
              className="btn-gold-hover billing-btn"
              disabled={busy || paymentRef.trim().length < 4}
              onClick={() =>
                void run(
                  () =>
                    mSubmit({
                      plan,
                      memberEmails: members.map((e) => e.trim()).filter(Boolean),
                      paymentRef,
                      note: note.trim() || undefined,
                    }),
                  "Request submitted — an admin will verify your payment.",
                )
              }
            >
              {busy ? <Loader2 size={15} className="billing-spin" /> : <Check size={15} />}{" "}
              I have paid — submit for approval
            </button>
          </section>
        </>
      )}

      {msg && <p className="billing-msg">{msg}</p>}

      {/* --------------------------- order history ------------------------ */}
      {(orders ?? []).length > 0 && (
        <section className="rules-section">
          <h2><ScrollText size={18} /> Your requests</h2>
          <div className="rules-map">
            <div className="rules-map__head">
              <span>Submitted</span><span>Plan</span><span>Status</span>
            </div>
            {(orders ?? []).map((o) => (
              <div key={o._id} className="rules-map__row">
                <span className="rules-map__base">{fmtDate(o.createdAt)}</span>
                <span className="rules-map__themed">
                  {o.plan} · {INR(o.amountInr)}
                </span>
                <span className={`billing-badge is-${o.status}`}>{o.status}</span>
                {o.adminNote && (
                  <span className="billing-adminnote">“{o.adminNote}”</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <TierTable config={config} />
    </div>
  );
}

/** What the two tiers actually contain. */
function TierTable({ config }: { config: any }) {
  return (
    <section className="rules-section">
      <h2><Sparkles size={18} /> What each tier includes</h2>
      <div className="rules-win">
        <div className="rules-win__card rules-win__card--good">
          <ScrollText size={22} />
          <h3>Free</h3>
          <ul>
            <li>Merlin &amp; the Assassin</li>
            <li>Percival &amp; Morgana</li>
            <li>Loyal servants &amp; minions</li>
            <li>The Medieval board</li>
            <li>5–10 players, voice &amp; video</li>
          </ul>
        </div>
        <div className="rules-win__card rules-win__card--evil">
          <Crown size={22} />
          <h3>Premium · {config?.seats ?? 7} seats</h3>
          <ul>
            {Object.entries(config?.premiumOptLabels ?? {}).map(([k, label]) => (
              <li key={k}>{label as string}</li>
            ))}
            <li>Every themed world (Mahabharata, Maratha, Greek, Egyptian)</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "./auth";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, BadgeCheck, Check, Clock, Crown, Loader2, LogOut, QrCode,
  ScrollText, Sparkles, Users, X,
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
  const [msgKind, setMsgKind] = useState<"ok" | "error">("ok");
  const [busy, setBusy] = useState(false);
  const [memberDraft, setMemberDraft] = useState<string[]>([]);

  const seats = config?.seats ?? 7;

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
    return upiLink(config.upiVpa, config.payeeName, amount, `Decevia ${plan} plan`);
  }, [config?.upiVpa, config?.payeeName, amount, plan]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      if (ok) { setMsg(ok); setMsgKind("ok"); }
    } catch (e: any) {
      setMsg(e?.message ?? "Something went wrong.");
      setMsgKind("error");
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------ loading ------------------------------- */
  if (viewer === undefined || config === undefined) {
    return (
      <div className="vd-board">
        <div className="vd-content vd-center">
          <p className="vd-loading" role="status">
            <Loader2 size={26} className="vd-spin" color="var(--vd-brass)" />
            <span>Loading your plan…</span>
          </p>
        </div>
      </div>
    );
  }

  /* --------------------------- not signed in --------------------------- */
  if (!viewer.signedIn) {
    return (
      <div className="vd-board">
        <div className="vd-content vd-page">
          <div className="vd-page__back">
            <a className="vd-pill" href="/play"><ArrowLeft size={13} /> Back to the game</a>
          </div>
          <header className="vd-page__head">
            <span className="vd-label vd-label--brass"><Crown size={13} /> Paid plan</span>
            <h1 className="vd-hero">Get the extra roles and settings</h1>
            <p className="vd-voice">
              One plan covers <strong>{seats} people</strong>, and the game is
              free to play without it. Sign in below to buy a plan, or to use a
              place on one somebody has already bought for you.
            </p>
          </header>
          {/* A section, not a bare card: `.vd-page__section:first-of-type`
              drops the rule and the top margin, and with the card outside the
              flow the tier table was first — its heading sat flush against the
              card's bottom studs. */}
          <section className="vd-page__section">
            <SignInCard />
          </section>
          <TierTable config={config} />
        </div>
      </div>
    );
  }

  /* ----------------------------- signed in ----------------------------- */
  return (
    <div className="vd-board">
      <div className="vd-content vd-page">
        <div className="vd-page__back">
          <a className="vd-pill" href="/play"><ArrowLeft size={13} /> Back to the game</a>
        </div>
        <header className="vd-page__head">
          <span className="vd-label vd-label--brass"><Crown size={13} /> Paid plan</span>
          <h1 className="vd-hero">{viewer.premium ? "Your plan" : "Get the extra roles and settings"}</h1>
          <p className="vd-voice">
            Signed in as <strong>{viewer.email}</strong>
            {viewer.isAdmin && (
              <>
                {" · "}
                <a className="vd-textbtn" href="/admin" style={{ display: "inline-flex" }}>admin console</a>
              </>
            )}
          </p>
          <button className="vd-textbtn" onClick={() => void signOut()}>
            <LogOut size={13} /> Sign out
          </button>
        </header>

        {/* ------------------------------ status ---------------------------- */}
        <section className="vd-page__section">
          <div className="vd-studded vd-panel vd-panel--strong vd-row" style={{ alignItems: "flex-start", gap: 16 }}>
            <span className="vd-stud-b" aria-hidden />
            {viewer.premium ? <BadgeCheck size={22} color="var(--vd-brass)" /> : <ScrollText size={22} />}
            <div>
              <strong className="vd-h3" style={{ display: "block", marginBottom: 6 }}>
                {viewer.premium ? "Your paid plan is active" : "You're on the free plan"}
              </strong>
              <p className="vd-voice" style={{ margin: 0 }}>
                {viewer.premium ? (
                  <>
                    Every role, add-on and setting is unlocked
                    {viewer.expiresAt ? <> until {fmtDate(viewer.expiresAt)}</> : null}.
                    {!viewer.iOwnPlan && viewer.ownerEmail && (
                      <> You have a place on <strong>{viewer.ownerEmail}</strong>'s plan.</>
                    )}
                  </>
                ) : (
                  <>
                    You can play full games with no time limit and up to 18
                    people. A paid plan adds the extra roles (Mordred, Oberon,
                    Guinevere, the lovers, the Lancelots), all three add-ons,
                    and the four other settings.
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* --------------------------- seat editor -------------------------- */}
        {sub && sub.iAmOwner && (
          <section className="vd-page__section">
            <h2 className="vd-h2 vd-h2--icon">
              <Users size={18} /> Who your plan covers
            </h2>
            <p className="vd-voice" style={{ margin: "8px 0 16px" }}>
              Your own place ({sub.ownerEmail}) is always included. You can add
              up to {sub.seats - 1} more people by email. Once they sign in with
              that address, any game they host or join gets the paid features.
            </p>
            <div className="vd-grid2">
              {Array.from({ length: sub.seats - 1 }).map((_, i) => (
                <input
                  key={i}
                  className="vd-field"
                  placeholder={`Person ${i + 1} — their email`}
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
              className="vd-btn vd-btn--primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => mMembers({ emails: memberDraft.map((e) => e.trim()).filter(Boolean) }),
                  "Saved. Everyone listed now has the paid features.",
                )
              }
            >
              <span>Save who's covered</span>
              <Check size={16} />
            </button>
          </section>
        )}

        {/* ---------------------------- buy flow --------------------------- */}
        {pendingOrder ? (
          <section className="vd-page__section">
            <h2 className="vd-h2 vd-h2--icon">
              <Clock size={18} /> Waiting for us to check your payment
            </h2>
            <div
              className="vd-studded vd-panel vd-panel--strong vd-row"
              style={{ alignItems: "flex-start", gap: 16, marginTop: 12 }}
            >
              <span className="vd-stud-b" aria-hidden />
              <Clock size={22} color="var(--vd-brass)" />
              <div>
                <strong className="vd-h3" style={{ display: "block", marginBottom: 6 }}>
                  {pendingOrder.plan === "yearly" ? "Yearly" : "Monthly"} plan ·{" "}
                  {INR(pendingOrder.amountInr)}
                </strong>
                <p className="vd-voice" style={{ margin: 0 }}>
                  You sent this on {fmtDate(pendingOrder.createdAt)} with the
                  reference <code>{pendingOrder.paymentRef}</code>. Someone will
                  check the payment and switch on the paid features for all{" "}
                  {pendingOrder.seats} people. Nothing else for you to do — you
                  can close this page.
                </p>
              </div>
            </div>
            <button
              className="vd-pill vd-pill--action"
              style={{ marginTop: 12 }}
              disabled={busy}
              onClick={() =>
                void run(() => mCancel({ orderId: pendingOrder._id }), "Request cancelled. You can submit a new one whenever you like.")
              }
            >
              <X size={14} /> Cancel this request
            </button>
          </section>
        ) : (
          <>
            <section className="vd-page__section">
              <h2 className="vd-h2 vd-h2--icon">
                <Crown size={18} /> 1. Choose a plan
              </h2>
              <div className="vd-grid2" style={{ marginTop: 16 }}>
                {(["monthly", "yearly"] as const).map((k) => {
                  const price = k === "yearly" ? config.yearlyInr : config.monthlyInr;
                  const on = plan === k;
                  return (
                    <button
                      key={k}
                      className={`vd-opt ${on ? "is-on" : ""}`}
                      style={{ minHeight: 96 }}
                      onClick={() => setPlan(k)}
                    >
                      <span className="vd-opt__top">
                        <span className="vd-opt__name" style={{ textTransform: "uppercase" }}>
                          {k === "yearly" ? "Yearly" : "Monthly"}
                        </span>
                        {on && <span className="vd-opt__lock"><Check size={14} /> Chosen</span>}
                      </span>
                      <span className="vd-numeral" style={{ fontSize: 22, color: "var(--vd-brass)" }}>
                        {INR(price)}
                      </span>
                      <span className="vd-opt__desc">
                        Covers {seats} people for{" "}
                        {k === "yearly" ? "a year" : "30 days"}
                        {k === "yearly" && (
                          <>. Saves {INR(Math.max(0, config.monthlyInr * 12 - config.yearlyInr))} versus paying monthly</>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="vd-page__section">
              <h2 className="vd-h2 vd-h2--icon">
                <QrCode size={18} /> 2. Pay {INR(amount)}
              </h2>
              {config.qrImageUrl ? (
                <div className="vd-stack" style={{ alignItems: "center", textAlign: "center", marginTop: 16 }}>
                  <span className="vd-qr-frame">
                    <img src={config.qrImageUrl} alt="Payment QR code" style={{ display: "block", width: 220 }} />
                  </span>
                  <p className="vd-voice">
                    Scan this with any UPI app to pay <strong>{INR(amount)}</strong>,
                    then copy the transaction reference into the form below.
                  </p>
                </div>
              ) : qr ? (
                <div className="vd-stack" style={{ alignItems: "center", textAlign: "center", marginTop: 16 }}>
                  <span className="vd-qr-frame">
                    <QRCodeSVG value={qr} size={188} level="M" includeMargin />
                  </span>
                  <p className="vd-voice">
                    Scan this with any UPI app to pay <strong>{INR(amount)}</strong>{" "}
                    to <strong>{config.upiVpa}</strong>, then copy the
                    transaction reference into the form below.
                  </p>
                  <a className="vd-textbtn" href={qr}>Or pay in an app on this phone</a>
                </div>
              ) : (
                <div className="vd-panel vd-panel--danger" style={{ marginTop: 16 }}>
                  <p className="vd-voice" style={{ margin: 0, color: "var(--vd-red-ink)" }}>
                    Payments aren't set up yet, so you can't buy a plan right
                    now. (If you're the admin: set <code>UPI_VPA</code> or{" "}
                    <code>PAYMENT_QR_URL</code> in the Convex environment.)
                  </p>
                </div>
              )}
            </section>

            <section className="vd-page__section">
              <h2 className="vd-h2 vd-h2--icon">
                <Users size={18} /> 3. Say who it covers, and send it
              </h2>
              <p className="vd-voice" style={{ margin: "8px 0 16px" }}>
                You're included automatically:
              </p>
              <div className="vd-tile vd-tile--parchment" style={{ marginBottom: 16 }}>
                {viewer.email}
                <span className="vd-tile__meta" style={{ color: "inherit" }}>You</span>
              </div>
              <p className="vd-voice" style={{ margin: "0 0 12px" }}>
                Add up to {seats - 1} other people, or leave these blank and fill
                them in later. Each person needs to sign in with the same email
                address you type here.
              </p>
              <div className="vd-grid2">
                {members.map((val, i) => (
                  <input
                    key={i}
                    className="vd-field"
                    placeholder={`Person ${i + 1} — their email (optional)`}
                    value={val}
                    onChange={(e) => {
                      const next = [...members];
                      next[i] = e.target.value;
                      setMembers(next);
                    }}
                  />
                ))}
              </div>

              <label className="vd-field__label" htmlFor="payref">
                Payment reference (UTR)
              </label>
              <input
                id="payref"
                className="vd-field"
                placeholder="e.g. 4179 1234 5678"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                aria-describedby="payref-help"
              />
              <span className="vd-hint" id="payref-help">
                Your UPI app shows this after the payment goes through. It's how
                we match your payment to your account.
              </span>
              <label className="vd-field__label" htmlFor="paynote">
                Anything else we should know? (optional)
              </label>
              <input
                id="paynote"
                className="vd-field"
                placeholder="e.g. paid from a different number"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <button
                className="vd-btn vd-btn--primary"
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
                    "Sent. We'll check your payment and switch the features on — usually within a few hours.",
                  )
                }
              >
                <span>
                  {paymentRef.trim().length < 4
                    ? "Add your payment reference to continue"
                    : "I've paid — send this for checking"}
                </span>
                {busy ? <Loader2 size={16} className="vd-spin" /> : <Check size={16} />}
              </button>
              <span className="vd-hint">
                We check payments by hand, so this usually takes a few hours.
                You'll see the status on this page.
              </span>
            </section>
          </>
        )}

        {msg && (
          <p
            className={`vd-panel ${msgKind === "error" ? "vd-panel--danger vd-errline" : "vd-panel--strong"}`}
            style={{ margin: "0 0 20px" }}
          >
            {msg}
          </p>
        )}

        {/* --------------------------- order history ------------------------ */}
        {(orders ?? []).length > 0 && (
          <section className="vd-page__section">
            <h2 className="vd-h2 vd-h2--icon">
              <ScrollText size={18} /> Your past requests
            </h2>
            <div className="vd-rowlist vd-rowlist--3col" style={{ marginTop: 16 }}>
              <div className="vd-rowlist__head">
                <span>Submitted</span><span>Plan</span><span>Status</span>
              </div>
              {(orders ?? []).map((o) => (
                <div key={o._id} className="vd-rowlist__row">
                  <span>{fmtDate(o.createdAt)}</span>
                  <span>{o.plan === "yearly" ? "Yearly" : "Monthly"} · {INR(o.amountInr)}</span>
                  <span>
                    <span
                      className={`vd-pill ${
                        o.status === "approved" ? "vd-pill--parchment"
                        : o.status === "pending" ? "vd-pill--brass"
                        : "vd-pill--danger"
                      }`}
                    >
                      {o.status === "approved" ? "Approved"
                        : o.status === "pending" ? "Being checked"
                        : "Not approved"}
                    </span>
                    {o.adminNote && (
                      <span className="vd-voice" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                        &ldquo;{o.adminNote}&rdquo;
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <TierTable config={config} />
      </div>
    </div>
  );
}

/** What the two tiers actually contain. */
function TierTable({ config }: { config: any }) {
  return (
    <section className="vd-page__section">
      <h2 className="vd-h2 vd-h2--icon">
        <Sparkles size={18} /> What each plan includes
      </h2>
      <div className="vd-grid2" style={{ marginTop: 16 }}>
        <div className="vd-panel vd-panel--strong" style={{ padding: 18 }}>
          <ScrollText size={22} color="var(--vd-brass)" />
          <h3 className="vd-h3" style={{ margin: "10px 0" }}>Free — no account needed</h3>
          <ul className="vd-list">
            <li>Merlin and the Assassin</li>
            <li>Percival and Morgana</li>
            <li>Plain good and evil players</li>
            <li>The Medieval Kingdom setting</li>
            <li>Games of 5 to 18 people</li>
          </ul>
        </div>
        <div className="vd-panel vd-panel--strong" style={{ padding: 18, borderColor: "var(--vd-brass)" }}>
          <Crown size={22} color="var(--vd-brass)" />
          <h3 className="vd-h3" style={{ margin: "10px 0" }}>
            Paid · everything in Free, plus…
          </h3>
          <ul className="vd-list">
            {Object.entries(config?.premiumOptLabels ?? {}).map(([k, label]) => (
              <li key={k}>{label as string}</li>
            ))}
            <li>The four other settings: Mahabharata, Maratha, Greek, Egyptian</li>
            <li>Covers {config?.seats ?? 7} people, not just you</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

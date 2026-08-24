# Decevia — Where Friends Become Foes

A multiplayer online **social deduction** platform for 5–18 players. Convene a
council, get a 4-letter code, share it, and find out who at your table is
lying. State syncs **live** through [Convex](https://convex.dev) — no polling,
no manual refresh — and players talk and see one another over free
peer-to-peer audio &amp; video.

## Routes

Hash routing, so every URL is really `/` — no server rewrites needed to host it.

| Route | What |
|---|---|
| `#/` | The landing page: a holding page with a **Coming soon** CTA |
| `#/play` | The game — convene / join, the lobby, and every phase after it |
| `#/rules` | The laws of the round table |
| `#/signin` | Create an account, sign in, recover a password |
| `#/upgrade` | Plans and purchase |
| `#/admin` | The console, for emails in `ADMIN_EMAILS` |

An invite link (`…/?code=ABCD`) goes straight to the table even without
`#/play`, so shared codes keep working while the front door is shut.

**When you open to everyone:** delete the *Enter the council* link in
`src/LandingPage.tsx` and point `#/` at the game.

## Worlds

Decevia is the platform; a **world** is the skin it wears. Same engine, same
rules, entirely different faces around the table — and the ground on which more
social deduction games will be added.

| World | The two sides |
|---|---|
| **Indian Mythology** | Pandavas (Dharma) vs Kauravas (Adharma) — the Mahabharata |
| **Medieval Kingdom** | Knights of Arthur vs Mordred's traitors — the original Avalon |
| **Egyptian Gods** | Every world has heroes; every kingdom has traitors |
| **Greek Mythology** | Olympus vs the Underworld |
| **Maratha Empire** | Swarajya vs Empire |

Worlds live in `convex/themes.ts` — a name, a tagline, two team names, a
palette, and a renamed role per engine role. Adding one is a data change, not
a code change.

Under the hood the engine is Avalon. Each world renames the same roles: Merlin,
Percival, the loyal servant, the Assassin, Morgana, Mordred, Oberon, the minion,
Guinevere, Tristan/Isolde and the two Lancelots — plus the expansions (Lady of
the Lake, Excalibur, plot cards). In Indian Mythology, for instance, that reads
as Krishna, Arjuna, Pandava Warrior, Ashwatthama, Shakuni, Duryodhana,
Jayadratha, Kaurava Warrior, Kunti, Abhimanyu/Uttara and Yuyutsu/Karna, with
Yaksha Prashna, Senapati Mudra and Niti Patra as the expansions.

## Why Convex (vs. the earlier polling version)

- **Reactive subscriptions** — `useQuery` re-renders the instant state changes.
- **Server-authoritative & secret-safe** — all game logic and roles live on the
  server. Each player's query returns *only* what they're allowed to see (their
  own role + their own knowledge). Votes show as counts until everyone has voted;
  roles are revealed only at game end. A player inspecting network traffic can't
  see other people's roles.
- **Atomic resolution** — vote and quest tallying happen inside transactional
  mutations, so there are no race conditions when several players act at once.

## Accounts, premium tier & admin

Playing is anonymous — a guest joins with a name and no account. An account
exists for three things: holding a subscription seat, buying one, and reaching
the admin console. Sign-in is **email and password**; there is no OAuth
provider and nothing to register with a third party.

### Tiers

| | Free | Premium (7 seats) |
|---|---|---|
| Roles | Merlin, Assassin, Percival, Morgana, servants, minions | + Mordred, Oberon, Guinevere, the lovers, both Lancelots |
| Expansions | — | Lady of the Lake, Excalibur, Plot cards |
| Worlds | Medieval | + Mahabharata, Maratha, Greek, Egyptian |
| Players seated | 5–18 | up to the plan's seat count |

A room's tier follows **the host's** plan. Seats are keyed on email, so a member
gets premium in any room they host or join once they sign in with that
address. The plan's seat count caps how many people are *seated* — which is what
stops one 7-seat plan covering a 10-player table.

> Note the current inversion: a free room seats the full ten, while a 7-seat plan
> seats seven. `npx convex env set SUBSCRIPTION_SEATS 10` removes it, after which
> a plan's seat count only governs who gets premium *content*.

## The table, and the room

A **game** seats 5–18 (see *Beyond ten* below). A **room** is unbounded: anyone
past the seat cap joins as a *watcher* rather than being turned away.

- The first N by `seat` are seated; everyone after is a watcher in a stable queue.
- Watchers see the board and are never dealt a role. Every game
  action refuses them server-side — vote, quest card, party membership, plot cards.
- Seats are kept dense (`0..n-1`), so when a seated player leaves, compaction
  promotes the queue head automatically. There is no separate promote step.
- The host can pull a specific watcher to the table (`swapSeat`), which is a
  straight exchange of two `seat` values and so preserves density.
- Hard ceiling is `ROOM_CAPACITY` (40) — joins are otherwise unbounded.

`convex/logic.ts` holds the pure primitives (`splitSeating`, `compactSeats`,
`swapSeats`, `seatCap`) and both the client and the server import them.

> The free/paid split lives in one place — `PREMIUM_OPT_KEYS` and
> `FREE_THEME_IDS` in `convex/logic.ts`. Note this currently puts the
> Mahabharata board (the app's own branding) behind the paywall; adding
> `"india"` to `FREE_THEME_IDS` is the one-line change to make it free.

### Purchase flow

`#/upgrade` → pick monthly or yearly → scan the UPI QR → paste the transaction
reference → an admin approves it at `#/admin`, which mints the subscription and
its seats. Nothing talks to a payment gateway; approval is the only thing that
grants access, and the price is always read server-side, never from the client.

The buyer can rename the covered emails at any time from `#/upgrade`.

### Admin console — `#/admin`

Payment requests (approve with a custom duration, or reject with a note), all
subscriptions (edit seats, +30 days, revoke, reactivate, delete), the user list
with tier, and a direct grant form for comps or payments taken offline.

## Beyond ten — a house rule

Avalon is printed for 5–10 players and defines no team split or mission sizes
above that. This engine goes to **20**, and rather than invent numbers both are
extrapolated from the printed table's own arithmetic:

| | Rule | Why |
|---|---|---|
| Evil count | `ceil(n / 3)` | Reproduces every official row exactly — 5→2, 6→2, 7→3, 8→3, 9→3, 10→4 — so it simply keeps going above ten. Good takes the rest. |
| Mission sizes | flat `3 4 4 5 5` at 8–10, then `+1` per further three players | Continues the printed table's own plateau. 11 rides 4/5/5/6/6; 18 rides 6/7/7/8/8. |
| Two-fail quests | the 4th at 7+, **and the 3rd above ten** | Parties grow with the head count, so a lone saboteur would otherwise be aboard nearly every mission. |

The 5–10 rows are literals in `convex/logic.ts` and are never computed; the
formulas are asserted against them in the test suite, so a future edit cannot
quietly change the printed game.

The seal scales with the table: past ten the ring widens and the seat discs
shrink in three bands, keeping the arc per seat above the seat's own width all
the way to eighteen.

> Worth knowing before you seat eighteen: the game is still **five quests** long,
> so at the largest sizes many players never ride. Extending the quest count is
> the obvious follow-up if that turns out to matter.

## The Council Seal (game UI)

The gameplay surface is the **Council Seal** system: flat blackened surfaces with
paper grain, aged brass for rank and state, parchment for anything you can act on.
No gradients, glow or shadows. The design lives in `design/` — open
`design/Verdict Council Seal Flow.dc.html`  <!-- pre-rename filename --> in a browser for the annotated spec,
and `design/COUNCIL_SEAL.md` for the tokens and per-screen rules.

`src/seal.css` is the whole system (imported after `styles.css` so its tokens
win). `src/table/` has one screen per phase, all sharing `TableShell` and the
`CouncilSeal` ring:

```
src/table/
  index.tsx           phase router + the actions the screens can call
  TableShell.tsx      board, grain, watermark, topbar
  Parts.tsx           quest column, chronicle, room -> seat-ring mapping
  LobbyScreen.tsx     seats, watcher queue, verbatim setup errors
  NightScreen.tsx     role card (press-and-hold) + the NIGHT_ORDER script
  ProposeScreen.tsx   clock fuse, seal, NAMED line, Excalibur assignment
  VoteScreen.tsx      hidden votes + the verdict / King Returns plates
  QuestScreen.tsx     card choice, Excalibur window, anonymous result
  LadyScreen.tsx      eligible targets, past holders disabled
  AssassinScreen.tsx  candidates + the lovers mode switch
  ReckoningScreen.tsx winReason, quest board, allegiances in seat order
  PlotHand.tsx        the deal, your hand, your private intel, the public log
```

Two consequences worth knowing. **Themes are now name-and-lore packs** — role
names, win reasons and taglines still come from `convex/themes.ts`, but the board
palette is fixed, so per-theme colours no longer apply to gameplay screens. And
seats show **heraldic sigils** (`src/sigils.tsx`, derived from `playerId`) rather
than avatars.

## Accounts, sign-in & email

Playing needs no account — a guest joins any room with a name. An account is
what holds a seat on a plan, buys one, and reaches the admin console.

**Email + password is the way in**, and it is always available. There is no
provider to configure and nothing to set up before the app is usable.

### Forgot your password

The sign-in card runs the whole recovery itself: *Forgot your password?* asks
for the address, Convex Auth mails a 6-digit code (15 minutes, single use), and
the second step spends the code and sets the new password in one go, landing
you signed in.

The code is deliberately short, which is safe only because the original email
must be presented with it — a code on its own is worthless to anyone who
intercepts it. Asking for a code never reveals whether an account exists.

**Recovery needs email to be working.** With no `RESEND_API_KEY` the request
fails loudly rather than leaving someone waiting for a code that was never
coming.

### Email (Resend)

Two messages go out, both to someone who just acted — no lists, no scheduling:

| When | What |
|---|---|
| An account is created | A welcome note. Failure is logged and swallowed; the account is made either way. |
| *Forgot your password?* | The reset code. Failure surfaces to the person waiting. |

Resend is spoken to over plain `fetch` in `convex/email.ts` — no SDK
dependency. Both templates live in that file.

> **The one gotcha.** Until you verify a domain, Resend's shared
> `onboarding@resend.dev` sender **only delivers to the address that owns the
> Resend account**. Every other recipient comes back `403 validation_error`. To
> send to real users: verify a domain at <https://resend.com/domains>, then set
> `EMAIL_FROM` to an address on it.

## Deploying (Vercel + Convex)

`vercel.json` pins the build, so the only thing to set in the Vercel dashboard
is one environment variable:

| Vercel env var | Where it comes from |
|---|---|
| `CONVEX_DEPLOY_KEY` | Convex dashboard → project → Settings → Deploy keys → **production** key |

That is the whole Vercel list. `convex deploy --cmd` deploys the backend and
injects `VITE_CONVEX_URL` into the build itself, so you never set it by hand —
and `VITE_CONVEX_SITE_URL`, which lingers in `.env`, is read by nothing.

No rewrite rules are needed: routing is hash-based, so every URL is really `/`
and a plain static deploy serves the whole app.

Everything else lives on the Convex **production** deployment, which starts
empty — see the table below and set each with `npx convex env set NAME value
--prod`. In order, once:

```bash
npx convex deploy              # creates the production deployment
npx @convex-dev/auth --prod    # writes JWKS + JWT_PRIVATE_KEY; sign-in needs them
npx convex env set SITE_URL https://your-domain --prod
# …the rest of the table below
```

Then sign up on the live site with an address in `ADMIN_EMAILS`: production
shares no accounts with dev.

## What you have to manage

Everything below is Convex **deployment** environment state, set with
`npx convex env set NAME value` (or in the Convex dashboard). It is **per
deployment** — nothing you set on dev carries over to production, so a deploy
means setting them again on the prod deployment.

| Variable | Needed | What happens without it |
|---|---|---|
| `RESEND_API_KEY` | for any email | Welcome notes are skipped; password reset fails outright. |
| `EMAIL_FROM` | to mail anyone but yourself | Falls back to `onboarding@resend.dev`, which only reaches your own Resend address. Format: `Name <you@your-domain.com>`. |
| `SITE_URL` | yes | The origin the links in your emails point at. Defaults to `http://localhost:5173`. **Set it to your real origin in production.** |
| `ADMIN_EMAILS` | no | Comma-separated. Defaults to `dewank.r@amberstudent.com`. Being on this list *is* admin — there is no separate admin password. |
| `UPI_VPA` | for payments | No payment QR can be generated. |
| `UPI_PAYEE_NAME` | no | Defaults to `Decevia`. |
| `PAYMENT_QR_URL` | no | A hosted image of your own static QR, shown instead of the generated one. |
| `PRICE_MONTHLY_INR` / `PRICE_YEARLY_INR` | no | Default to `299` / `2499`. |
| `SUBSCRIPTION_SEATS` | no | Defaults to `7`. |
| `JWKS` / `JWT_PRIVATE_KEY` | yes | Written once by `npx @convex-dev/auth`. Sign-in cannot work without them. Never rotate casually — it signs out everyone. |

The client also reads `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` from
`.env.local`, which `npx convex dev` writes for you.

### Recurring jobs

- **Admin.** Approve or reject purchases in `#/admin`; that is what mints a
  subscription. Nothing sweeps expired plans — entitlement is recomputed from
  `expiresAt` on every read, so a lapsed plan simply stops unlocking content.
- **Secrets.** `RESEND_API_KEY` is the only third-party secret in the project.
  Rotating it is a `convex env set` and nothing else.
- **Accounts.** There is no self-serve account deletion. Removing someone means
  deleting their `users` row plus their `authAccounts` / `authSessions` /
  `authRefreshTokens` rows — do it from the Convex dashboard, and note that
  `subscriptions.ownerUserId`, `orders.userId` and `rooms.hostUserId` point at
  that row.

## Project layout

```
convex/
  auth.ts       Convex Auth — email + password, reset, welcome mail
  auth.config.ts / http.ts   JWT issuer and the /api/auth/* routes
  entitlements.ts  who is premium, who is an admin, pricing (reads ctx.auth only)
  billing.ts    subscriptions, seats, orders, admin operations
  schema.ts     tables: rooms, players, votes, questCards, signals,
                plotHands, plotLog, plotMarks, secrets,
                subscriptions, seats, orders, + Convex Auth tables
  logic.ts      pure rules: team sizes, role dealing, secrecy knowledge,
                card restrictions, loyalty & plot decks, setup validation
  avalon.ts     queries + mutations (state machine, read model, A/V signaling)
  themes.ts     five worlds: role names, lore, colours, expansion naming
src/
  main.tsx      ConvexAuthProvider + hash routing (#/rules, #/upgrade, #/admin)
  UpgradePage.tsx  plans, UPI QR, seat form, request history
  AdminPage.tsx    approvals, subscriptions, users, manual grants
  App.tsx       Mahabharata-themed UI + video grid, driven by Convex hooks
```

## Run it

You need Node 18+.

```bash
npm install

# 1) First terminal — start Convex. The first run logs you in (browser),
#    creates a dev deployment, generates convex/_generated/*, and writes
#    .env.local with VITE_CONVEX_URL. Leave it running.
npx convex dev

# 2) Second terminal — start the web app.
npm run dev
```

Open the printed localhost URL. To test multiplayer locally, open it in several
browser tabs / windows (each tab is a separate player — they each generate their
own id). To play with friends remotely, deploy:

```bash
npx convex deploy        # production Convex deployment
npm run build            # build the static frontend (dist/)
```

Host `dist/` on any static host (Vercel, Netlify, Cloudflare Pages, etc.) with
`VITE_CONVEX_URL` set to your production deployment URL.

## Notes

- Your player identity is stored in `localStorage`, so a refresh keeps your seat.
  If that's cleared, rejoin with the **same name** to reclaim your seat.
- Merlin & the Assassin are always in play. The host can toggle Percival,
  Morgana, Mordred, Oberon, Guinevere, the lovers (Tristan + Isolde) and the two
  Lancelots. The lobby shows seats used per side and refuses to start an illegal
  roster; the server re-validates and enforces a legal deck regardless.
- Standard rules: per-count team sizes, the two-fail 4th quest for 7+ players,
  5 rejected proposals in a row = evil, and the Assassin's hunt for Merlin if
  Good completes three quests. With the lovers in play the Assassin may instead
  name *both* of them.

## Expansions

All three follow the [Avalon wiki](https://avalon-game.com/wiki/) and are
independent host toggles. Every theme renames them (see `expansions` in
`convex/themes.ts`); the rules underneath are identical.

- **The Lancelots** — one Good, one Evil, and neither knows the other. Their
  mission card is *forced*: Evil Lancelot must Fail, Good Lancelot must Succeed.
  A 5-card loyalty deck (2 switches, 3 blanks) is drawn from round 3 onward; a
  switch trades both their sides. Merlin's night vision is a **snapshot**, so a
  switched Lancelot still reads as Evil to him.
- **Lady of the Lake** (7+ players) — the token starts to the first leader's
  right. After quests 2–4 the holder learns one player's *current* allegiance,
  then passes the token to them. Past holders can never be examined.
- **Excalibur** — the leader arms one party member (never themselves). Once all
  mission cards are in, the holder may flip one. The table sees *who* was
  struck; only the two of them ever learn what the card had been.
- **Plot cards** — the leader deals 1 (5–6p) / 2 (7–8p) / 3 (9–10p) face-down
  cards each round to other players. Nine card types across three kinds:
  `instant` resolves on receipt, `usable` is held for a specific window, and
  `charge` lasts all game. Who holds how many is public; which cards is not.
  **Ambush** is the only one that leaves no public trace.

Every short expansion window (plot dealing, King Returns, Excalibur, the Lady)
auto-resolves to its do-nothing outcome on a timer, so a disconnected player can
never stall the table.

> Note: the wiki fixes the plot deck's *size* (7 cards at 5–6 players, 15 at
> 7–10) and the full card list with copy counts, but not which subset makes up
> the smaller deck. That composition is an engine choice, marked as such in
> `convex/logic.ts`.

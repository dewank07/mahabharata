# Dharmayuddha — The War of Kurukshetra

A multiplayer online social-deduction game for 5–20 players, themed on the
**Mahabharata**: the **Pandavas (Dharma)** against the **Kauravas (Adharma)**.
Convene a war council, get a 4-letter code, share it, and play through war-party
proposals, council votes, the battles of Kurukshetra, and Ashwatthama's final
strike at Krishna. State syncs **live** through [Convex](https://convex.dev) —
no polling, no manual refresh — and players talk and see one another over free
peer-to-peer audio &amp; video.

(Under the hood this is the Avalon engine; the roles map as: Krishna=Merlin,
Arjuna=Percival, Pandava Warrior=loyal servant, Ashwatthama=Assassin,
Shakuni=Morgana, Duryodhana=Mordred, Jayadratha=Oberon, Kaurava Warrior=minion,
Kunti=Guinevere, Abhimanyu/Uttara=Tristan/Isolde, Yuyutsu/Karna=the two
Lancelots. Expansions are themed too: Yaksha Prashna=Lady of the Lake,
Senapati Mudra=Excalibur, Niti Patra=plot cards.)

## Why Convex (vs. the earlier polling version)

- **Reactive subscriptions** — `useQuery` re-renders the instant state changes.
- **Server-authoritative & secret-safe** — all game logic and roles live on the
  server. Each player's query returns *only* what they're allowed to see (their
  own role + their own knowledge). Votes show as counts until everyone has voted;
  roles are revealed only at game end. A player inspecting network traffic can't
  see other people's roles.
- **Atomic resolution** — vote and quest tallying happen inside transactional
  mutations, so there are no race conditions when several players act at once.

## Free voice &amp; video chat (WebRTC)

The game has a built-in **War Council** with both audio *and* video — and it's
genuinely free, no third-party account:

- Media flows **peer-to-peer over WebRTC**, so there are no per-minute charges.
- **Convex is the signaling channel** (offers/answers/ICE candidates go through
  the `signals` table) — the backend you already have, at no extra cost.
- Connectivity uses **Google's free public STUN servers**.

Tap **Join voice & video** in the bar at the top. You join with the mic on and
camera off; the camera button turns video on/off anytime (handled with the
WebRTC *perfect-negotiation* pattern so tracks can be added/removed mid-call).
Tiles show everyone on the call, ring green when someone talks, and fall back to
an initial when a camera is off.

Notes &amp; limits:
- It's a **mesh** (each player connects directly to every other). Audio scales
  fine to 10; **video** is best kept to ~4–6 cameras on at once — each active
  camera is uploaded to every peer. Video is capped to 320×240@15fps to help.
  For many simultaneous cameras you'd add an SFU (e.g. LiveKit/mediasoup) — not free.
- Camera/mic need a **secure context**: `localhost` in dev, HTTPS in production
  (any static host gives you HTTPS automatically).
- STUN-only connects on most home networks. Behind strict/symmetric NATs you may
  need a **TURN** relay — there's a commented `iceServers` slot in
  `src/useVoice.ts` (self-hosted `coturn` is the free route).

## Accounts, premium tier & admin

Playing is still anonymous — a guest joins with a name and no account. Google
sign-in exists for three things: holding a subscription seat, buying one, and
reaching the admin console.

### Tiers

| | Free | Premium (7 seats) |
|---|---|---|
| Roles | Merlin, Assassin, Percival, Morgana, servants, minions | + Mordred, Oberon, Guinevere, the lovers, both Lancelots |
| Expansions | — | Lady of the Lake, Excalibur, Plot cards |
| Worlds | Medieval | + Mahabharata, Maratha, Greek, Egyptian |
| Players seated | 5–20 | up to the plan's seat count |

A room's tier follows **the host's** plan. Seats are keyed on email, so a member
gets premium in any room they host or join once they sign in with that Google
account. The plan's seat count caps how many people are *seated* — which is what
stops one 7-seat plan covering a 10-player table.

> Note the current inversion: a free room seats the full ten, while a 7-seat plan
> seats seven. `npx convex env set SUBSCRIPTION_SEATS 10` removes it, after which
> a plan's seat count only governs who gets premium *content*.

## The table, and the room

A **game** seats 5–20 (see *Beyond ten* below). A **room** is unbounded: anyone
past the seat cap joins as a *watcher* rather than being turned away.

- The first N by `seat` are seated; everyone after is a watcher in a stable queue.
- Watchers see the board and hear voice, and are never dealt a role. Every game
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
| Mission sizes | flat `3 4 4 5 5` at 8–10, then `+1` per further three players | Continues the printed table's own plateau. 11 rides 4/5/5/6/6; 20 rides 7/8/8/9/9. |
| Two-fail quests | the 4th at 7+, **and the 3rd above ten** | Parties grow with the head count, so a lone saboteur would otherwise be aboard nearly every mission. |

The 5–10 rows are literals in `convex/logic.ts` and are never computed; the
formulas are asserted against them in the test suite, so a future edit cannot
quietly change the printed game.

The seal scales with the table: past ten the ring widens and the seat discs
shrink in three bands, keeping the arc per seat above the seat's own width all
the way to twenty.

> Worth knowing before you seat twenty: the game is still **five quests** long,
> so at the largest sizes many players never ride. Extending the quest count is
> the obvious follow-up if that turns out to matter.

## The Council Seal (game UI)

The gameplay surface is the **Council Seal** system: flat blackened surfaces with
paper grain, aged brass for rank and state, parchment for anything you can act on.
No gradients, glow or shadows. The design lives in `design/` — open
`design/Verdict Council Seal Flow.dc.html` in a browser for the annotated spec,
and `design/COUNCIL_SEAL.md` for the tokens and per-screen rules.

`src/seal.css` is the whole system (imported after `styles.css` so its tokens
win). `src/table/` has one screen per phase, all sharing `TableShell` and the
`CouncilSeal` ring:

```
src/table/
  index.tsx           phase router + the actions the screens can call
  TableShell.tsx      board, grain, watermark, topbar, voice controls
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
than avatars; voice audio and the camera toggle live in the topbar.

## Google sign-in setup

Sign-in and billing need one-time configuration. Until it is done the app still
runs — everyone is simply on the free tier, and `#/admin` says so.

1. **Generate Convex Auth keys** (writes `JWKS` + `JWT_PRIVATE_KEY` to the
   deployment):

   ```bash
   npx @convex-dev/auth
   ```

2. **Create a Google OAuth client** at
   <https://console.cloud.google.com/apis/credentials> → *OAuth client ID* →
   *Web application*. Add this authorised redirect URI, using your Convex
   **site** URL (the `.convex.site` one, not `.convex.cloud`):

   ```
   https://<your-deployment>.convex.site/api/auth/callback/google
   ```

3. **Set the deployment environment variables** (`npx convex env set NAME value`,
   or the Convex dashboard):

   | Variable | Required | Purpose |
   |---|---|---|
   | `AUTH_GOOGLE_ID` | yes | Google OAuth client ID |
   | `AUTH_GOOGLE_SECRET` | yes | Google OAuth client secret |
   | `SITE_URL` | yes | Where to return after sign-in, e.g. `http://localhost:5173` |
   | `ADMIN_EMAILS` | no | Comma-separated admins. Defaults to `dewank.r@amberstudent.com` |
   | `UPI_VPA` | for payments | Your UPI ID, e.g. `you@okhdfcbank` — the QR is generated from it |
   | `UPI_PAYEE_NAME` | no | Name shown in the payer's app. Defaults to `Dharmayuddha` |
   | `PAYMENT_QR_URL` | no | Hosted image of your own static QR; shown instead of the generated one |
   | `PRICE_MONTHLY_INR` | no | Defaults to `299` |
   | `PRICE_YEARLY_INR` | no | Defaults to `2499` |
   | `SUBSCRIPTION_SEATS` | no | Defaults to `7` |

   Set `SITE_URL` to your production origin when you deploy.

4. Restart `npx convex dev`, then sign in from the app header.

To give yourself premium without paying, sign in once, then use **Grant a plan**
in `#/admin`.

## Project layout

```
convex/
  auth.ts       Convex Auth + Google provider
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
  useVoice.ts   WebRTC mesh hook — mic + camera, perfect-negotiation signaling
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

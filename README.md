# Dharmayuddha — The War of Kurukshetra

A multiplayer online social-deduction game for 5–10 players, themed on the
**Mahabharata**: the **Pandavas (Dharma)** against the **Kauravas (Adharma)**.
Convene a war council, get a 4-letter code, share it, and play through war-party
proposals, council votes, the battles of Kurukshetra, and Ashwatthama's final
strike at Krishna. State syncs **live** through [Convex](https://convex.dev) —
no polling, no manual refresh — and players talk and see one another over free
peer-to-peer audio &amp; video.

(Under the hood this is the Avalon engine; the roles map as: Krishna=Merlin,
Arjuna=Percival, Pandava Warrior=loyal servant, Ashwatthama=Assassin,
Shakuni=Morgana, Duryodhana=Mordred, Jayadratha=Oberon, Kaurava Warrior=minion.)

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

## Project layout

```
convex/
  schema.ts     tables: rooms, players, votes, questCards, signals (+ indexes)
  logic.ts      pure rules: team sizes, role dealing, secrecy knowledge
  avalon.ts     queries + mutations (game logic, read model, A/V signaling)
src/
  main.tsx      ConvexProvider wiring
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
  Morgana, Mordred, and Oberon in the lobby (the UI caps evil specials to the
  available evil slots, and the server enforces a valid deck regardless).
- Standard rules: per-count team sizes, the two-fail 4th quest for 7+ players,
  5 rejected proposals in a row = evil, and the Assassin's hunt for Merlin if
  Good completes three quests.

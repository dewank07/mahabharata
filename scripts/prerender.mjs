/* ============================================================================
   Prerender the public pages to real HTML, after `vite build`.

   WHY, precisely — because the reason matters for what this can and cannot do:

   Googlebot does run JavaScript, so the app was already indexable. What it was
   not was indexable *cheaply*: rendering is queued and can lag crawling by days,
   and every route served byte-identical HTML, so Google saw one title and one
   description for six URLs. Everything that is not Google — Bing's older paths,
   and every social scraper that builds a link preview — runs no JS at all and
   saw an empty <div id="root">.

   This writes a real document per public route: its own title, description,
   canonical and Open Graph tags, and body copy a crawler can read without
   executing anything. React mounts over it for humans, because `createRoot()`
   replaces the container's children rather than hydrating them — so this
   content never has to match what React renders, and there is no hydration
   mismatch to manage.

   It will not make the site rank. Ranking is content, links and relevance.
   What this removes is the mechanical reason a crawler would index the site
   badly or not at all.

   No dependencies: string templating over the built index.html.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");

/** Change this in one place if the domain changes. */
const ORIGIN = process.env.SITE_ORIGIN ?? "https://www.decevia.space";

/**
 * The crawlable copy, per route.
 *
 * Hand-authored rather than rendered from the components, deliberately: the
 * pages depend on Convex hooks and CSS imports that do not survive a bare node
 * render, and the build must not gain a bundling step it can fail on. The cost
 * is that this can drift from the app — so keep it to the durable claims a
 * page makes, not the details that change.
 */
const PAGES = [
  {
    path: "/",
    file: "index.html",
    title: "Decevia — Social deduction for 5 to 18 players",
    description:
      "A free hidden-roles party game for 5 to 18 people in the same room, played on your phones. Most of you are good; a few are secretly not. No download and no account — just a four-letter code.",
    body: `
      <h1>Decevia — where friends become foes</h1>
      <p>
        A hidden-roles party game for 5 to 18 people in the same room, played on
        your phones. Most of you are on the good team. A few are secretly
        working against it, and they know who each other are. Five missions
        decide who wins, and the group chooses who goes on each one, out loud,
        with no way to prove anything.
      </p>
      <p>
        Free to play in a browser. No download and no account: one person starts
        a game, shares the four-letter code, and everyone else joins from their
        own phone.
      </p>
      <h2>How a game works</h2>
      <ul>
        <li>5 to 18 people, free or paid — group size is not part of the plan.</li>
        <li>Everyone is secretly dealt a side: good, or one of the few who are evil and know each other.</li>
        <li>Five missions. Good wins if three succeed; evil wins if three fail.</li>
        <li>Evil also wins if five teams in a row are voted down, without a single mission being played.</li>
        <li>Even after three missions succeed, the evil team gets one guess at who Merlin is.</li>
      </ul>
      <h2>Five settings</h2>
      <p>
        The same game with different character names: Indian Mythology (Pandavas
        and Kauravas), the Medieval Kingdom of Arthur and Mordred, Egyptian
        Gods, Greek Mythology, and the Maratha Empire. The rules are identical
        in all of them.
      </p>
      <p>
        <a href="/rules">How to play</a>
      </p>`,
  },
  /* /learn and /rules are one page in the app now, so they are one document
     here too — same title, same body, and /learn pointing its canonical at
     /rules so a crawler is never offered two URLs for the same thing. Both
     paths stay because both are in links that have already been handed out. */
  ...["/rules", "/learn"].map((path) => ({
    path,
    file: `${path.slice(1)}/index.html`,
    canonical: "/rules",
    title: "How to play Decevia — the rules, and a round you can watch",
    description:
      "Watch a round play out a moment at a time, then look it up: how a round works, how you win, how many are evil at every table size, what each role is shown, and the full cast.",
    body: `
      <h1>How to play</h1>
      <p>
        Watch one round happen a moment at a time, then read what each role can
        do. Every setting is the same game with different character names.
      </p>
      <h2>A round, start to finish</h2>
      <p>
        The leader chooses a team. Everyone votes yes or no on it — not just the
        people going. If it passes, only the people on the team play a card,
        face down: Succeed or Fail. Good players can only play Succeed. The
        cards are shuffled before they are turned over, so nobody learns who
        played what. Arguing about that is the whole game.
      </p>
      <h2>How you win</h2>
      <p>
        Good wins by getting three missions to succeed — unless the evil team
        then correctly guesses who Merlin is, which takes the game at the last
        second. Evil wins by making three missions fail, or by getting five
        teams in a row voted down.
      </p>
      <h2>How many are evil</h2>
      <p>
        You don't choose this: it is fixed by how many people are playing —
        roughly one in three — and so is the size of each mission team. With 7
        or more players, mission 4 needs two Fail cards to fail rather than one.
      </p>
      <h2>Secret roles</h2>
      <p>
        Everything anyone knows for certain comes from one moment at the start:
        the evil players are shown each other, Merlin is shown the evil players
        but not Mordred, Percival is shown two names and told one of them is
        Merlin, and ordinary good players are shown nothing at all.
      </p>
      <p><a href="/">Play Decevia</a></p>`,
  })),
];

const shell = readFileSync(join(DIST, "index.html"), "utf8");

/** Swap one meta/link value in the built head. */
function setTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    console.warn(`  ! prerender: no match for ${pattern} — head tag left as built`);
    return html;
  }
  return html.replace(pattern, replacement);
}

let wrote = 0;
for (const page of PAGES) {
  const url = `${ORIGIN}${page.path}`;
  let html = shell;

  html = setTag(html, /<title>[\s\S]*?<\/title>/, `<title>${page.title}</title>`);
  html = setTag(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${page.description}" />`,
  );
  html = setTag(
    html,
    /<link rel="canonical"[^>]*\/>/,
    `<link rel="canonical" href="${ORIGIN}${page.canonical ?? page.path}" />`,
  );
  html = setTag(
    html,
    /<meta property="og:title"[^>]*\/>/,
    `<meta property="og:title" content="${page.title}" />`,
  );
  html = setTag(
    html,
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${page.description}" />`,
  );
  html = setTag(
    html,
    /<meta property="og:url"[^>]*\/>/,
    `<meta property="og:url" content="${url}" />`,
  );

  // The content itself. React replaces these children on mount, so this is
  // written for crawlers and for anyone whose JavaScript never arrives.
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><div class="prerender">${page.body.trim()}</div></div>`,
  );

  const out = join(DIST, page.file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`  prerendered ${page.path.padEnd(8)} -> dist/${page.file}`);
  wrote++;
}

console.log(`✓ prerendered ${wrote} page${wrote === 1 ? "" : "s"} for ${ORIGIN}`);

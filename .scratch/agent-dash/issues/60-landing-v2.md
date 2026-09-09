Type: implementation
Status: needs-triage
Blocked by:
Label: ready-for-agent

# Landing v2 — slogan, paragraph, four reads; sign-in as a mock provider page

## Goal

Replace the one-line landing (ticket 37) with the page the human iterated to on 2026-09-10, and
restyle `/sign-in` as its second screen with mock provider buttons and one demo action. Desktop
and phone. Reference render: `docs/landing/img/picture-v2.png`, source
`docs/landing/img/picture-v2.html`. **The render is the spec for layout and type; this file is the
spec for copy, behaviour, tests and docs.** Where they disagree, this file wins.

Every decision below was taken by the human on 2026-09-10 (ticket 59 and the four answers recorded
in § Decisions). Nothing here is open; do not ask, build.

## Decisions already taken

| Question | Answer |
|---|---|
| Where do the four figures come from? | **Hardcoded copy, exactly as written below.** No "illustrative" label. MVP, time-bound. They do not match the fixture and that is accepted. |
| Fonts | **Fraunces (display) and Manrope (body) on `/` and `/sign-in` only**, via `next/font/google`. The dashboard keeps Geist. |
| The MCP line | **Ship as written**, and add an MCP surface as the first item under *Next* in `docs/roadmap.md`. |
| Sign-in | **Provider buttons (Google, Apple, GitHub) that open the real provider sign-in pages in a new window, an SSO email input, and one demo action.** The contractor account is not offered on the page; it is reached from the header switcher. Wording in § Sign-in. |
| Dark mode | Follow the app's `.dark` variant: paper tokens invert to a slate surface with the same ink relationships. Not a separate design; the same CSS variables, second values. |
| R-N1 (one link) | **Holds on `/`:** exactly one `<a>`, to `/sign-in`. On `/sign-in` there are four: three external provider links and `Back` to `/`. |
| The refused claim | **Holds.** No `faster`, `productiv`, `velocity`, `ship more`, `10x` anywhere on either page. The copy below was checked. |

## Copy — `/` (verbatim, in order)

**Kicker above h1:** none.

**h1:** `What your agents do, spend and solve, per finished job.` — with *per finished job.* in the
italic light weight. Single `<h1>`; the italic is a `<em>` inside it, so the heading's text content
is exactly the string above.

**Paragraph:**
`Accountability for agent use: where it converts, where it leaks, and who has it figured out. Every attempt is priced, keyed to an issue and a person, and counted only when its work was accepted.`

**CTA (the one link):** `Open the demo →` → `/sign-in`.

**Section kicker:** `ONE TOOL, FOUR READS` (small caps, above a rule).

**Four reads.** Each has five parts, in this vertical order: label · claim · figure + caption ·
reading · verb.

| # | Label | Claim | Figure | Caption | Reading | Verb |
|---|---|---|---|---|---|---|
| 01 | `01 · Unit cost` | `Your cost per finished job, and which way it is moving` | `$76.50` | `per finished job in August, up from $64.83 in May` | **`+18% since May, on 1.4× the jobs.`** ` Failed attempts and idle seats are in the numerator, so waste raises the figure.` | `Defend it to finance` |
| 02 | `02 · Where it leaks` | `81 cents of every dollar landed on an attempt that was accepted` | `19%` | `of spend on failed attempts and idle seats` | **`Both can be cut without cutting output.`** ` 41 of 570 tasks needed a second attempt, and one seat sat nearly idle all season.` | `Reclaim it` |
| 03 | `03 · Where it converts` | `The same agents, a 20× spread by where you point them` | `$7 → $144` | `per finished job, by repository and template` | **`Push agents where the work converts.`** ` Where it does not, change the template or take the work back. Deploy converts one in three.` | `Redirect the work` |
| 04 | `04 · Where the cloud earns its keep` | `A third of agent machine time runs with nobody at the keyboard` | `35%` | `of attempts run headless; a further 32% of supervised time is unattended` | **`The cloud earns its keep when work runs while people are elsewhere.`** ` Where sessions are mostly supervised, a laptop would have done.` | `Offload the right work` |

The bold lead of each reading is `<b>`/`font-semibold`; the rest is muted.

**Band label** (once per figure band, top-right, small caps): `FIGURES FROM THE DEMO ORGANISATION`.

**Closing line** (below the reads, above a thin rule, max-width ~720px):
**`Ask, don't dig.`** ` Every figure about agent work in your organisation, from the bill to where it converts and which teams run lean, is available over MCP to whichever AI assistant your team already uses. Connect it once and ask in plain words.`

No footer, no nav, no logo, no other text.

## Layout — `/`

**Desktop (≥ 1024px).** Content column 1120px, centred, top padding ~120px. h1 72px, line-height
1.04, max-width ~980px. Paragraph 19px, max-width 640px, muted. CTA is a pill with a 1.5px ink
border, no fill.

The four reads are **one grid, four columns, five rows**, so the three middle rows form three
horizontal bands that run across all four columns and touch each other:

1. **Labels row** — on the page surface, outside any band. Serif, 13px, muted.
2. **Claims band** — a card: surface slightly lighter than the page, 1px border, radius 18px on the
   top corners only, no bottom border. Claims are serif 22px, line-height 1.22.
3. **Figures band** — tinted (darker than the page), **bleeds 40px wider than the card on both
   sides**, 1px hairlines top and bottom. Figures serif 44px; caption 12.5px muted under each. The
   band label sits at its top-right corner, inside the bleed.
4. **Readings band** — a white card, 1px border, radius 18px on the bottom corners only, no top
   border. 14.5px, line-height 1.5.
5. **Verbs row** — on the page surface, outside any band. 11.5px, small caps, letter-spacing .12em,
   ink colour.

Columns are separated by a 1px hairline inside bands 2–4 (not in rows 1 and 5). Inner horizontal
padding 28px. The grid is CSS Grid with explicit `grid-row`/`grid-column` placement. The bands are not
absolutely positioned: each is a grid item spanning `1 / -1` in its row, drawn under the cells
with `z-index`.
Read `picture-v2.html` for the exact recipe; port it to Tailwind utilities plus a small scoped CSS
block where utilities cannot express `grid-row` spans cleanly.

**Phone (390px, the `mobile-chromium` project).** Single column. h1 40px. Paragraph 17px. The four
reads **stack**, and **each read keeps its own three bands** (claim card top / tinted figure band
with the label / white reading card bottom) with its label above and verb below, so the demo data
stays visibly separated in each. The figure band's 40px bleed becomes a full-bleed to the viewport
edge. `document.documentElement.scrollWidth <= 390` on `/` and `/sign-in`.

**Tablet (640–1023px).** Two columns of reads, two rows; bands run across each pair. Acceptable to
implement as two stacked copies of the desktop grid with two columns each.

## Design tokens (scoped to the two public routes)

Define under a wrapper class on `main` (e.g. `.landing`), light values, with `.dark` overrides:

| Token | Light | Dark |
|---|---|---|
| page surface | `#f7f5f0` | `#151a27` |
| claims card | `#fbfaf7` | `#1a2030` |
| figures band | `#ebe7de` | `#0f1420` |
| readings card | `#ffffff` | `#1e2434` |
| rule / hairline | `#ddd8cd` | `#2b3245` |
| ink | `#14213d` | `#f3f1ec` |
| ink 2 (body muted) | `#4a5068` | `#c3c2b7` |
| ink 3 (labels) | `#8a8f9e` | `#8a8f9e` |

Fonts via `next/font/google` in a **route-group layout** so the dashboard does not load them:
create `src/app/(public)/layout.tsx` and move `page.tsx` and `sign-in/page.tsx` under `(public)/`.
Fraunces: weights 300 (italic and roman) and 500, `opsz` axis, `display: swap`. Manrope: 400, 500,
600. Expose as `--font-display` and `--font-body` on the wrapper. Route paths do not change.

Motion: one staggered entrance on the hero (h1, paragraph, CTA at 0 / 120 / 240ms, opacity +
8px translate) and nothing else. Honour `prefers-reduced-motion: reduce` by disabling it.

## Sign-in — `/sign-in`

Same fonts, same page surface, same centred column (max-width 560px), h1 one step below the
landing's (40px desktop / 30px phone). **No client JavaScript**; the demo action stays a plain
`<form method="post" action="/api/session">` exactly as today.

**Copy, in order:**

- **h1:** `Sign in`
- **Paragraph** (muted): `Use your organisation's identity, or step straight into the demo.`
- **Provider row** — three pills side by side (stacked on phone), 1px border, provider glyph left,
  label right. They are **links to the real provider sign-in pages, opened in a new window**:

  | Label | `href` |
  |---|---|
  | `Continue with Google` | `https://accounts.google.com/` |
  | `Continue with Apple` | `https://appleid.apple.com/sign-in` |
  | `Continue with GitHub` | `https://github.com/login` |

  Each is `<a target="_blank" rel="noopener noreferrer">`. Nothing is exchanged with the provider;
  the link is the whole integration. Provider glyphs are inline monochrome SVG, no icon library.
- **Divider:** a hairline with `or` centred.
- **SSO block:** label `Work email`, `<input type="email" placeholder="you@company.com" disabled>`
  and a `<button type="button" disabled title="Not connected in the demo">Continue with SSO</button>`.
  One line under it, 12.5px muted: `Single sign-on is not connected in the demo.`
- **Demo card** — the only working control, and the **only** sign-in form on the page. A bordered
  card, surface = claims-card token:
  - small caps label `DEMO ACCOUNT`
  - one sentence: `You will be Nuria Castells Vidal, the open default: every Member by name, their jobs, their tokens, their cost.`
  - the form's single submit button, filled ink pill, full width: **`Sign in to the demo account`**
  - one quiet line under it, 13px muted, plain text, no control: `Switch to the restricted contractor view from the header on any page.`
- **Back link:** `Back` → `/`.

The hidden `member_id` is the **first** account from `signInAccounts()` (R-A4 order: open default
first); do not hardcode the id. The restricted account is **not rendered on this page**. It stays
seeded, stays in `signInAccounts()`, and stays reachable through the header account switcher
(R-A5), which is where the README's thirty-second path already switches. Keep `return_to`
behaviour untouched.

**Spec amendment.** Append to `spec.md` R-A4, without renumbering: *Amended 2026-09-10, ticket 60:
`/sign-in` offers one "sign in to the demo account" action for the open default; the restricted
account is reached from the header switcher (R-A5).*

## Tests — what changes, and what must not

**Update (strings only, no scope change):**
- `src/app/page.test.tsx`: h1 text → the new slogan; the productivity regex stays; **one link to
  `/sign-in`** stays.
- `e2e/smoke.spec.ts`: landing h1 → new slogan; link count 1 → `/sign-in` stays. Sign-in: h1 →
  `Sign in`; `main form` count **1**; `main button[type=submit]` count **1**; links: **four**, three
  with `target="_blank"` and `rel` containing `noopener`, pointing at the three provider hosts, and
  one to `/`. The SSO button is `type="button"` and `disabled`.
- `src/app/sign-in/page.test.tsx`: one form, one submit named `Sign in to the demo account`, the
  three provider anchors with the hrefs above, the restricted account's name **absent** from the
  page.
- `e2e/enforcement.spec.ts` line ~96: the open-account click becomes
  `getByRole("button", { name: "Sign in to the demo account" })`. Line ~80: the restricted-account
  click through the page **goes away**; sign in as the contractor with the existing
  `useSession(context, { member_id: RESTRICTED_ACCOUNT.memberId, org_slug }, baseURL)` helper from
  `e2e/support/session.ts`, or through the header switcher where the test is about the switch.
  `grep -rn "Continue as" e2e src` and fix every hit.

**Add:**
- `e2e/mobile.spec.ts`: `/` and `/sign-in` at 390×844, `scrollWidth <= 390`.
- `e2e/smoke.spec.ts`: the landing contains the band label text at least once (desktop renders it
  once; phone renders it once per read), and the four verbs are present as text, in order.
- `src/app/page.test.tsx`: the four claims render as `<h2>` (four level-2 headings, in order).

**Must not change:** `e2e/payload.spec.ts`, `enforcement.spec.ts` assertions about rows and
redirects, anything under `src/domain/**` or `src/data/**` except nothing. This ticket touches
`src/app/(public)/**`, `src/app/globals.css` (tokens only, appended), tests named above, and docs.

## Docs

- `docs/positioning.md`: append a dated block **without deleting the 2026-09-09 text**:
  `## Revision — 2026-09-10` with **One line:** the new slogan; **Audience:** the VP of Engineering
  asked what agent use returned; **Held to:** the four reads on `/`. Update the *Held to* table's
  first row to point at the new h1. Remove the *Proposed revision, open* note.
- `README.md` § 1 first bold line → the new slogan; § 2 step 1 → `Sign in to the demo account`;
  step 4 stays (the switch happens from the header).
- `docs/roadmap.md` § Next, first item: **An MCP surface over the query façade** — every
  ViewModel the pages render, exposed as read-only tools so any assistant can ask for cost per
  finished job, the leak split, the repository × template grid and the unattended share. Cheap for
  the same reason CSV export is: the seam is a data structure (ADR-0006). Note that the landing
  already promises it.
- Ticket 59: set `Status: resolved`, `Label: resolved`, append a pointer to this ticket.
- `docs/landing/README.md`: one line at the top: *Built as ticket 60.*

## Done when

- `pnpm lint`, `typecheck`, `test`, `test:coverage`, `build`, `e2e` all green, both Playwright
  projects.
- `/` at 1440 matches `picture-v2.png` in structure, type, bands and copy (eyeball, not pixel).
- `/` and `/sign-in` at 390 have no horizontal scroll and read top to bottom in the stated order.
- The dashboard routes load **no** Fraunces or Manrope font files (check the network panel or the
  built `.next` output).
- Clicking a provider pill opens the provider's own sign-in page in a new tab and leaves `/sign-in`
  in place.
- The forbidden-word regex passes on both pages.
- Commit message body lists every test whose strings changed, by file.

## Notes

- Ticket 59 carries the reasoning: jobs-to-be-done, the competitor read, the seven-point stack
  rank, and why block 4 is efficiency rather than money.
- The four figures are the human's; they are not the fixture's. Do not "fix" them to match the
  demo, and do not add a disclaimer. That is the recorded MVP decision.
- `docs/landing/img/picture-v1.*` and `shape-c-cards.*` are superseded references; leave them.

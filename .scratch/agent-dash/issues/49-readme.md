Type: implementation
Status: resolved
Blocked by: 39, 40, 41, 42, 43, 44, 45, 46, 47, 48
Label: resolved

# README

## Scope

In this order, under 200 lines:

1. The positioning block: one line, the claim, who it is for, what we refuse to claim, three
   levers, the open-visibility default, what it is not. Source: the human's positioning of
   2026-09-09 (copy is in `docs/positioning.md`, write that file first from this ticket's Notes).
2. Live URL, the two demo accounts, and the thirty-second path: sign in as open, read the four
   tiles, switch to restricted, watch People shrink.
3. One screenshot of `/demo` at 1440, committed under `docs/img/`.
4. How it is built: stack, the computation/rendering seam, the fixture generator, the gates.
5. How to run: install, dev, test, coverage, e2e, generate fixtures.
6. Test posture: coverage gate, property tests, mutation score (from ticket 52), fixture contract.
7. Links: `CONTEXT.md`, `docs/adr/`, `docs/roadmap.md`, the specs.

## Notes

Positioning text to place in `docs/positioning.md`:

One line: Agent spend, priced per finished task. Not per token, not per seat.
Claim: every agent platform tells you what you spent; none tells you what you got for it. This
dashboard joins the two. Cost per completed task, with failed attempts in the numerator.
Audience: the engineering leader who signs the agent bill and cannot explain it.
Refused claim: no productivity gain, no pre-agent baseline exists.
Levers: model mix (200× price spread by tier), rework (a task that needed three attempts cost
three times its price), seats (a seat held against near-zero usage is the most expensive unit of
work in the org).
Default: individual spend is open to everyone in the org, symmetric, sorting but no leaderboard.
Not: a billing page, a trace viewer, a performance review tool.

## Comments

### 2026-09-09 — implemented (AFK build, wave 8, primary worktree, straight to `main`)

`lint` 0 problems · `typecheck` clean · `test` **1389** across 63 files · `test:coverage` statements
98.4 / branches 88.92 / functions 98.96 / lines 99.52 · `build` 10 routes, Turbopack · `pnpm e2e`
**152 passed** (chromium + mobile-chromium).

**`README.md` is 198 lines**, seven sections in the ticket's order. `docs/positioning.md` was
written first, from this ticket's Notes, **verbatim** — the human's seven lines are copied
unedited, and everything the file adds is below a rule and labelled as not part of the positioning:
a table mapping each line to the artefact that holds it to (the landing `<h1>`, the fourth tile,
`e2e/smoke.spec.ts`, ADR-0007, ADR-0003, R-D4, R-N15). The two do not say the same thing about one
word and that is deliberate: the human's line reads **priced** per finished task, the shipped
landing reads **measured**, and `src/app/page.tsx`'s own header records why ("a vendor's verb on a
hero reads as how this product charges you"). `README.md` § 1 quotes the *live* line, since a front
door that disagrees with the page it opens is worse than either; `docs/positioning.md` keeps the
human's and the divergence is visible in one hop.

**§ 1 states the refused claim as the third paragraph and does not smuggle a productivity claim
back in.** `e2e/smoke.spec.ts` asserts the landing against `/faster|productiv|velocity|10x/i`; the
README names that test as the thing that holds the refusal. The one nuance carried over from
`page.tsx` is that *"not per seat"* is a claim about the reported unit and not about the cost base
— Total spend includes seat cost, at 46.2% of it, and a reader who takes the line the other way
finds the apparent contradiction one click in.

### The screenshot was produced, not claimed

`docs/img/demo-1440.png` — **2880 × 1240, 129 KB, valid PNG** (signature and IHDR checked by hand
after writing, not assumed). 1440 CSS px wide at `deviceScaleFactor: 2`.

Taken **against the production build**, not `next dev`: `pnpm build` then `next start --port 3000`,
driven by a throwaway Playwright script (`chromium.launch()`, deleted before the commit — no spec
file was added and no test identifier was allocated). The first attempt was against `next dev` and
carried **Next's dev-tools badge** in the bottom-left corner; `next start` has no such indicator, so
the production build was the cheaper fix and needed no `devIndicators` change to `next.config.ts`.
The viewport height was then trimmed from 820 to 620 so the frame ends just below the tiles rather
than on 300px of empty page.

The path in the script is the reader's path, not a cookie injection: `goto /sign-in` → click the
first `main form`'s submit → `waitForURL(/\/demo$/)`. So the shot is of a real session issued by
`POST /api/session`, on the default period, with no query string.

**Why the default month rather than a fuller one.** `/demo` opens on September 2026, which is
partial — 41 completed Jobs against August's fuller months — and every tile therefore carries
*Partial month* where its delta would be. That is what a visitor to the live URL sees, and
`src/data/clock.ts` clamps `now` to the window's last day so it will stay that way. A screenshot of
a hand-picked fuller month would be a picture of a page nobody lands on. The cost: the front door's
figures are smaller than the product's best month. Accepted, and § 2 explains the flag rather than
hiding it.

### The thirty-second path was walked, and the figures are read off the screen

Not paraphrased from the spec. Signed in as **Nuria Castells Vidal** (Open default): `/demo` reads
Total spend **$1,107.92** · Completed Jobs **41** · the breakdown Implementation 16, Bug fix 13,
Review 10, Refactor 5, Deploy 1 · Cost per completed Job **$27.02**. `/demo/people` renders **20**
member rows. Opening the account switcher and choosing **Restricted (contractor)** —
**Héctor Camps Vidal** — stays on `/demo/people` and the table renders **1** row, with the
visibility sentence changing from *"…and every other Member of this Organization by name"* to
*"…without being named."* Both sentences are quoted in § 2 as the product spells them. The account
descriptions in the table are `src/app/sign-in/page.tsx`'s own copy, quoted rather than rewritten.

### The live URL is verified, not assumed

**<https://agent-use-dash.vercel.app>** — `GET /` and `GET /sign-in` both **200**, `GET /demo`
**307 → /sign-in** (the proxy's optimistic redirect, so `AUTH_JWT_SECRET` is provisioned in
production). The deployment is **current**: its `/sign-in` payload carries ticket 47's two account
cards with both Members' names, which did not exist before this wave. The URL is in
`.env.example` as `NEXT_PUBLIC_SITE_URL` and in the project's memory notes; the Vercel project is
named `agent-use-dash` while the GitHub repo is `agent-dash`, which is why grepping the repo for
"agent-dash.vercel.app" finds only `scripts/setup-vercel.sh`'s example text. No placeholder was
needed.

### Inbound links discharged

Each of these was recorded elsewhere as "owed by ticket 49", and each is now a live link from
`README.md`:

- **`docs/roadmap.md`** (ticket 50) — § 7. It was linked from nowhere; it now has its only inbound
  link, described by what it decides rather than by its filename.
- **`docs/adr/0009-scale.md`** (ticket 54) — § 7, named individually inside the `docs/adr/` bullet
  because its Done-when asks for the README specifically, and because it is the ADR that argues § 4's
  seam survives volume.
- **`docs/ingest.md`** (ticket 55) — § 7, same requirement.
- **The mutation score** (ticket 52) — § 6 carries that ticket's drafted line as drafted: 96.18%,
  1,362 mutants, Stryker 10 with the Vitest runner, ~7 minutes, **not a CI gate**, with the link to
  the survivor list and its "a score printed without its survivor list is the number that file
  exists to argue against". **The tool was not re-run**, exactly as ticket 52 asked.
- Also linked, though not owed: `CONTEXT.md`, `docs/adr/`, `docs/security.md`, `docs/positioning.md`,
  the three specs and `.scratch/agent-dash/issues/`.

### Decisions taken without asking

**§ 6's coverage and test counts are the numbers this run measured, not the numbers earlier tickets
recorded.** `pnpm test` and `pnpm test:coverage` were run before § 6 was written and the output was
quoted: 1,389 / 63 files, and 98.4 · 88.92 · 98.96 · 99.52. They differ from the AFK build report's
(1,099 tests, 98.19 · 88.07) because eleven tickets have landed since. Cost: the figures will drift
again the next time a test lands, and nothing regenerates them. The alternative — quoting no
figure — would have made § 6 an assertion instead of a reading.

**The commit counts and the ticket count are stated loosely on purpose.** "58 tickets … over a
hundred-odd commits" rather than an exact SHA count, because the exact number is wrong the moment
this commit lands.

**Nothing was allocated.** No requirement ID, no `T-*` identifier, no spec edit. `README.md`,
`docs/positioning.md` and `docs/img/demo-1440.png` are the only files added; `src/app/page.tsx` was
read and not touched.

### Left open

- **The README's figures are a snapshot of one fixture and one run.** The four tile values, the 20/1
  row counts and the coverage percentages are all quoted literally. They are stable while the
  fixture and the clamp in `src/data/clock.ts` are, and there is no test asserting the README agrees
  with the app. Writing one would mean pinning prose to figures, which § 6's own argument about
  string-literal mutants says not to do — but the exposure is real and belongs to whoever next
  changes the fixture.
- **The screenshot is `/demo` alone.** The five other surfaces — where most of the argued design
  lives — are described in words and seen only by following the live URL. A second image was not
  added: the ticket asks for one, and a README that opens with a gallery is the feature grid the
  landing page was kept clear of.
- **`docs/coverage-gaps.md` and `docs/assignment.md` are not linked from the README.** The first is
  a working document rather than a decision, and the second is the brief this was built against;
  neither is a door a reader should be sent through first. Recorded because the README's § 7 claims
  to be where the decisions are, and these two are in `docs/` and are not in it.

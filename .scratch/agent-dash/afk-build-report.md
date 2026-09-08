# The unattended build — what happened

Written 2026-09-08 by the session that ran it. Companion to `handover-afk-build.md`, which set it up.

**Every implementation ticket is `resolved` and every gate is green on `main`.** CI run 34176088361
passed. 42 commits, all pushed.

| Gate | Result |
|---|---|
| `pnpm lint` | **0 problems** (the one long-standing warning was resolved by ticket 38) |
| `pnpm typecheck` | clean |
| `pnpm test` | **1,099** tests, 53 files |
| `pnpm test:coverage` | statements 98.19 · branches 88.07 · functions 98.77 · lines 99.53; every `src/domain/**` per-file 95/90 met |
| `pnpm build` | 10 routes, Turbopack |
| `pnpm e2e` | **97** passed, verified under `CI=1` against the production build as well as dev |

## Nothing is red

No ticket was stopped by a § 8 condition. No rule was disabled, no test skipped, no
`eslint-disable`, `@ts-expect-error` or `as any` anywhere in `src/` or `e2e/`.

**One acceptance criterion is deliberately unowned: A28.** It is a spec-versus-spec conflict and
therefore a human decision, not an implementer's — see below.

## Wave order, as merged

| Wave | Tickets | Notes |
|---|---|---|
| 0 | 17 | scaffold + the lint amendment as step 0 |
| 1 | 18, 19 | spike (unmerged, on `prototype/18-rollup-spike`) · fixture generator |
| 2 | 20 | data-load boundary |
| 3 | 21, 22 | access model · periods |
| 4 | 23, 27, 29 | aggregation · change/series · auth |
| 5 | 24, 25, 26 | **fanned out**, three worktrees |
| 6 | 28 | the query façade |
| 7 | 30 | shell + controls |
| 8 | 31 | chart frame |
| 9 | 32, 33, 34, 35, 36 | **fanned out**, five worktrees |
| 10 | 38 | e2e + gates |

**The wave-9 parallel assumption held.** Ticket 28's Done-when was verified before opening it —
every panel had a query and each agent rendered one route from one page ViewModel, so none needed
to touch `queries.ts`. Wave 5 merged with zero conflicts. Wave 9 produced **one** conflict: tickets
32 and 35 independently created `src/components/panels/figures.ts`. It was reconciled by intent
rather than by picking a side, and one of the two implementations turned out to have a bug (a flat
period rendered `+0%`), so the merge fixed something neither branch would have.

## Ticket 18's finding

**The reconciliation is real; the predicted symptom is not; and that is what made it worth
patching.**

Flipping one chart from a 20-Member grouping to a 4-Team one reuses the *same DOM node objects* for
the surviving legend entries — `firstNodeIdentical: true`, all four reused. React does reconcile
"Member 1" into "Team A" in place, exactly as ticket 14 predicted.

But the rendered output is correct. Label and colour both update, because `ChartLegendContent`
writes each as a controlled attribute on every render. The predicted symptom — *"the colour
persists, the label changes"* — **does not occur**. Series elements behave the same: `<Bar>` keyed
by index and by `dataKey` produced byte-identical fills.

So the defect is **latent, and latency is the problem**. R-T32 defers patches that announce
themselves; this one never would. Three reasons decided it:

1. **There is no encounter to wait for.** The output is right today, so nothing surfaces it.
2. **Lint cannot catch it.** Ticket 17 made `react/no-array-index-key` an error — and also
   global-ignores `src/components/ui/**` as vendored. `chart.tsx` is exactly there. The rule that
   exists for this bug class does not cover the one file in the repo committing it. This was not
   visible until ticket 17 landed.
3. **T-C3 would otherwise pin the bug**, since it must fail if `key={index}` is reintroduced.

Patch 3 was applied in ticket 31, at **two** sites (the ticket assumed one), after T-C3 was written
and watched to fail against the pristine component. Ticket 18's recorded tooltip diff needed one
change to typecheck. The spike stays on `prototype/18-rollup-spike` (`c378fc9`) and is not merged.

Two side findings: **patch 2 is a false alarm** — `[&_.recharts-cartesian-axis-tick_text]` is
Tailwind arbitrary-variant syntax where `_` is a space, so it compiles to a descendant selector,
not a stale class name. And `ChartContainer` passes `initialDimension`, the R-T29/T-C0 construct,
which ticket 31 worked around without adding a `ResizeObserver` polyfill.

## Waiting for a human

1. **Ticket 37 — landing copy.** Untouched, as instructed. `ready-for-human`.
2. **Production `AUTH_JWT_SECRET`** — `scripts/setup-vercel.sh` stage 5. Dev and CI are provisioned.
3. **A28 / T-E8 contradict R-A10.** A28 and T-E8 say the permission matrix renders for the open
   account and *not* the restricted one. R-A10 says both see it, each showing its own grants, and
   § 11 **C6** is the later resolution that made it so, arguing the literal reading produces "a
   matrix nobody can see". § 12 then says the spec has **no** open questions *because* C6 settled
   this — which is further evidence A28 is stale, but it is still the spec contradicting itself.
   The domain layer (ticket 21) has no way to express "the restricted account holds no `access`",
   because `self` over every class is enforced ahead of the grant list. **Implemented per R-A10;
   the contradicted assertion is named but unwritten**, with the claims that hold under either
   reading written instead. A28's traceability row cites T-U10, which supports R-A10 — do not read
   T-U10 passing as A28 satisfied.
4. **R-N8 stacks a non-partition.** The fourth summary tile stacks *Completed Tasks* by WorkType,
   justified by "every AgentSession references exactly one WorkType" — true of sessions, not of
   Tasks. 118 Tasks in the fixture span more than one. Measured live: open account, Aug 2026, the
   stacked columns sum to **162** against the Completed Jobs tile's **150** (restricted: 55 against
   49). That is the false geometric claim R-V1 exists to prevent and T-C11 calls a failure. The
   spec was followed. Two honest alternatives are recorded on ticket 32.
5. **T-E2 renders 1 row where the spec describes 2.** The restricted account gets its own named row
   plus an aggregate *sentence*, not the Team aggregate *row* testing-spec describes. The e2e
   asserts the difference in kind sharply and the count as a range with the shortfall named.
6. **`/demo` tiles 2 and 4 show the same figure and change**, because the ViewModel builds tile 4
   from tile 2's reading. A real cost on the page graded for the ten-second read.
7. **The `/demo` period control fights R-N7** — selecting a month clips the range so no prior bucket
   exists and all four change figures suppress. R-N7 holds only on the default range.
8. **`perCapita` is declared for `/demo/spend` but never read**, so that control changes nothing —
   in tension with R-C1.

## Spec defects found and recorded, not edited

- **R-D5's premise is false at UTC+2**, so **A7's own test case cannot fail**. 23:30 Madrid is 21:30
  UTC on the *same* date; the discriminating rows are just after local midnight. Proved by mutation:
  swapping `periods.ts` to UTC fails 14 tests and the test named for A7 is **not** one of them. The
  fixture seeds both populations; T-U1 covers both.
- **Ticket 10's median/p95 session costs are unreachable** alongside R-D4's totals. R-D4 wins.
- **R-D6 and R-D7 are two marginals of one table** and cannot both hold unless they agree on the
  grand total — a constraint neither states.
- **R-D7 is a cross-WorkType acceptance figure by construction**, i.e. the number R-M6/A21 forbid
  the product to state. It is a fixture property, verified by T-F4 over raw JSON, never through the
  metric.
- Ticket 25's scope says `90+` where R-M16 and T-U16 say `91+`; ticket 34's says "five of six" where
  R-N13 says four of five; T-U4's "comparable with neither of the others" contradicts its own next
  bullet unless "the others" means the three code WorkTypes; T-E9's literal wording is unsatisfiable
  against this fixture; T-E6 cites A5 where it means R-A5.

## Defects found in committed code and fixed

- **The lint amendment's premise was half wrong and its target mattered more than assumed.** The
  layering rules guarded `src/lib`, which `shadcn init` then created for its `cn` helper — so they
  were guarding the wrong directory rather than an empty one.
- **A rule-clobbering bug, found by probe.** The new fixture-I/O block and the domain block both set
  `no-restricted-imports` over `src/domain`, and flat config *replaces* rule options rather than
  merging them — so the later block silently dropped the entire domain boundary while still
  appearing to lint. Every boundary rule is now verified against a deliberate violation.
- **The chart palette was a zero-chroma grey ramp, identical in light and dark.** `--chart-1` was
  ~1.2:1 on white, so the top-ranked series in every chart was invisible; `--chart-5` was near-black
  on near-black in dark mode. Replaced with five hues validated as a set in both modes.
- **Model mix rendered unpainted bars** at `family`/`exact`: the display label was the series key, so
  shadcn minted `--color-Claude Sonnet`, an invalid property name. The legend swatch reads
  `--chart-N` directly and stayed coloured — the silent wrong-colour class again. A test now asserts
  every series key on every page is a valid CSS ident.
- **R-N13's shared axis was never honoured.** `ChartFrame` had no measure-extent input, so Recharts
  scaled each acceptance multiple to its own maximum: at month grain `deploy` at 33% drew as tall as
  `implementation` at 67%.
- **The comparator claimed a comparison it never made** — a median over a peer set of one rendered
  "$4.70" against a "group median" of "$4.70". Withheld below two values.
- **24 requirement citations were rendering to users** ("…never a cost proxy (R-M9)").

## T-E4 — three false-positive classes, fixed without weakening it

T-E4 is the product's central privacy claim and the one assertion only E2E can make. It searches
the payload for bare decimals, and at this fixture's density (525 ungranted money literals in a
narrow range) **value identity is not fact identity**. Three classes were found and fixed:

1. **Own aggregates.** The restricted account holds `self` over cost, so its own weekly totals are
   legitimate — and collide with other Members' session costs. The subtraction now covers sums over
   (period × grouping), computed from raw fixture JSON rather than by calling `queries.ts`, because
   using the code under test to decide what the test permits would make a real leak invisible.
2. **Identifiers.** `3.1` inside `gemini-3.1-pro-preview` was being read as a number. The decimal
   regex now excludes letters and hyphens — which also retired the workaround of keeping fractional
   Tailwind spacing out of class names.
3. **Quotients.** `/demo/work` renders **no money at all** and was failing on `0.7`, `0.6`, `0.86` —
   acceptance rates. Ratios are now subtracted within a single bucket rather than across a cross
   product, along with R-N11's published token rate card. The *compute* card is deliberately left in
   the search set, so if it ever ships both T-E9 and T-E4 fail.

The set went 439 → 459 → 348 across those changes and the floor is now 300, stated with the
breakdown rather than lowered quietly. **The falsification probe was re-run after each change**
against the production build: a name and a cost rendered inside a `<section hidden>` still fail both
assertions and name the leaked values, while `not.toBeVisible()` **passes** on the same page — which
is the whole argument for payload inspection, re-confirmed rather than assumed. Ticket 38 added the
permanent positive control: the open account's payload is asserted to carry the 19 names the
restricted account must not receive.

**T-E4 also caught a real leak during ordinary work** — ticket 30's account switcher named the other
account's Member in the header, putting a named individual in the payload of a viewer holding no
identifying scope over them. That is the access model doing its job.

## Method notes

The build used mutation checks throughout rather than trusting green: tickets 22, 23, 25, 26, 27 and
24 each broke their own implementation deliberately and confirmed the suite caught it. Two of those
runs changed the work — ticket 27's first discriminating dataset turned out **not** to discriminate
(a per-bucket implementation would have passed on it) and was rebuilt; ticket 26 found that a `mean`
*field* and a `meanDuration` *function* need different guards, and that a `model_id` hidden inside an
object type is invisible to a source scan and caught only by compile-time pins.

`docs/coverage-gaps.md` carries T-Q3's ranked list of what is *not* covered in `src/domain/**`,
ordered by what the product's claims rest on rather than by percentage. Its top two items are things
coverage already calls covered.

## Branches left in place

`prototype/18-rollup-spike` (the spike, deliberately unmerged) and the nine `ticket/*` branches,
all merged into `main` with `--no-ff`. All worktrees removed.

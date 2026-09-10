Type: implementation
Status: resolved
Blocked by: 62, 65
Label: resolved

# Fixture: window to 25 Sep, one to nine sessions per Member per workday, spend as a smooth function of time

## Goal

The dataset runs **12 Apr – 25 Sep 2026** and is busy: on a typical workday each human Member
runs between one and nine root sessions. Weekly session spend is a function of time — modest and
noisy from April, then rising, and from July on it fluctuates within ±20% of its trend. The seat
fee stops being the sharpest finding; the spec says so instead of pretending otherwise.

Decided by the human, 2026-09-10 (confirmed: per human Member, ~8,000 roots).

## What exists today

- `src/fixtures/targets.mts` — `WINDOW_END_DAY = 2026-09-08`, `WINDOW_DAYS = 150`, `RAMP`
  (median 0 → 2 sessions per Member per **week**), `SEAT_SHARE_RANGE` 0.44–0.52,
  `MEDIAN_SESSION_COST_RANGE`, `CHILD_*`.
- `src/fixtures/schedule.mts` — weekly Poisson per Member, weekday-weighted day pick.
- Committed data: 742 roots, 1,049 rows; org-wide median 5 roots per day; weekly session cost
  swings 54 → 373 → 135 between adjacent weeks.
- Spec R-D2, R-D3, R-D4 (and the R-D4 collision note), fixture README figures, README figures,
  ADR-0009 (what changes at scale — cites current row counts).
- `organization.json` `window_end` / `window_days` are read by the app (ticket 62 cuts at now).

## Scope

1. **Window.** `WINDOW_END_DAY = 2026-09-25`, `WINDOW_DAYS = 167`; DST check still passes (no
   transition until 25 Oct). `organization.json` follows.
2. **Volume.** Replace the weekly ramp with a **daily** model per human Member: on a workday,
   sessions ~ 1 + Poisson(λ(t)·activity), capped at 9, with λ rising from ~1.5 in April to ~4 in
   September; weekends at 15% of the weekday rate; one Member (R-D10) stays near-idle
   (`LOW_USAGE_SESSIONS` may rise to ≤ 12 across the window — still "fewer than 1% of a peer's").
   Service accounts keep their own schedules, scaled ×3. Target ≈ 7,500–8,500 roots; children
   stay at `CHILD_ROOT_SHARE` 0.2.
3. **Spend curve.** Author `WEEKLY_SPEND_SHAPE`: a smooth target for weekly session cost (a
   logistic ramp from ~$450/week in April to a plateau in August–September), and a tolerance
   band: weeks whose first day is before 1 July within ±40% of the curve, weeks from 1 July
   within **±20%**. The generator repairs toward the curve by scaling that week's token draws
   (not by moving sessions) and asserts the band. Costs are "more modest initially" by
   construction of the ramp; do not add a separate price ramp.
4. **Targets that change meaning.** `SEAT_SHARE_RANGE` becomes a *ceiling* (≤ 0.25) and
   `MEDIAN_SESSION_COST_RANGE` is deleted here (ticket 68 sets the token/cost distribution).
   Keep R-D6/R-D7 acceptance marginals, R-D8 rates, R-D11–R-D15, R-D19, R-D21 as they are.
5. **Spec and docs.** R-D2 → new dates and day count; R-D3 → new counts; R-D4 rewritten: "volume
   is one to nine root sessions per human Member per workday, ramping from April; the seat fee is
   a minor share of Total spend". Strike the R-D4 collision paragraph (moot). README, fixture
   README, ADR-0009 numbers updated. Landing figures are hardcoded by ticket 60's decision and
   are **not** touched.
6. **Performance.** ~10,000 rows on disk: check `pnpm test` and `pnpm e2e` wall time before and
   after and record both in the ticket comments; if the contract test or the mutation run slows
   past 2×, note it under ADR-0009 rather than fix it here.

## Done when

- Generator asserts: per-human-workday root count within 1..9 for ≥ 95% of (Member, workday)
  pairs with any session; weekly spend within the band; window dates.
- `pnpm fixtures:generate` is byte-stable across two runs.
- With `AGENT_DASH_NOW` unpinned and today inside the window, every page renders and no row is
  dated after now (ticket 62's slice).
- All six gates green; e2e counts in `people.spec.ts`/`reading.spec.ts` updated to derived, not
  literal, values where they were literals.

## Notes

Runs after ticket 62, because from this ticket on the committed data extends past today.
Escalation rule applies (handover): pick the cheaper option, write it down, keep going.

---

## Comments

### 2026-09-10 — implemented (AFK wave 3, worktree `agent-dash-t66`, branch `ticket/66`)

**The fixture is 10,879 rows over 12 Apr – 25 Sep 2026, and weekly spend follows an authored
logistic.** `pnpm fixtures:generate` is **byte-stable**: verified by generating into three
separate temp directories and diffing them against each other and against the committed
`src/fixtures/data/`, and re-verified after every later edit to the generator.

#### What each Scope item became

1. **Window.** `WINDOW_END_DAY = 2026-09-25`, `WINDOW_DAYS = 167`; `organization.json` follows
   through `catalog.mts`. 12 Apr 2026 is a Sunday, so every full 7-day bucket holds five workdays
   and the closing bucket (20–25 Sep) holds six days and still five workdays. The DST check passes
   unchanged — `assertClock` verifies +02:00 against `Intl` on every row, and the next transition
   is 25 Oct.
   *Two bounds had to move with it, both latent bugs the old volume hid.* A hidden retry is
   offset 2–20 hours from the attempt it shadows, which on a busy last day fell off the end of the
   window; `rows.mts` now bounds the offset by the room left and excludes drafts with none. And
   `assertClock`'s window **ceiling** now applies to roots only: a root opening at 23:40 on the
   last day spawns a child after midnight, and `ended_at` has always been free to pass
   `window_end`. `assertTree` is what holds a child inside its own root.
2. **Volume.** `RAMP` is gone; `DAILY_VOLUME` replaces it. On a workday a human Member runs
   `1 + Poisson(λ(t)·activity)` capped at 9, on a weekend day `Poisson(λ(t)·activity·0.15)`. λ is
   a logistic in window fraction, 1.5 → 4, midpoint 0.5, steepness 9. The per-Member activity
   multipliers are **normalised to mean 1 over the humans**, so λ alone fixes the org-wide rate
   rather than the draw doing it. Service accounts keep the old weekly zero-inflated Poisson
   (`SERVICE_RAMP`) with its mean **and its cap** ×3 — scaling the mean alone would have pinned
   both accounts to the cap every week from June and turned a Poisson draw into a constant.
   Realised: **7,761 visible roots** (target 7,500–8,500), 2,960 children at `CHILD_ROOT_SHARE`
   0.2, 158 hidden roots. `LOW_USAGE_SESSIONS` **held at 3** rather than raised to 12 — see
   escalations.
3. **Spend curve.** New module `src/fixtures/curve.mts`. `WEEKLY_SPEND_SHAPE` is a logistic in
   dollars per *full* week sharing `DAILY_VOLUME`'s midpoint and steepness, spread over a week's
   own days by `dayVolumeWeight` so the six-day closing bucket is targeted at 97% of a full week
   rather than six sevenths of one. `WEEKLY_SPEND_BAND` is ±40% before 1 July and ±20% from it.
   The repair scales that week's **token draws** and re-prices; it moves no session. `spend.mts`
   then asserts the full band independently, over roots carrying their children.
4. **Targets.** `SEAT_SHARE_RANGE` → `SEAT_SHARE_CEILING = 0.25` (realised **7.1%**);
   `MEDIAN_SESSION_COST_RANGE` deleted. The `CHILD_SCALE` and `SEAT_SHARE` comments that argued
   for the old ~48% figure are rewritten, not worked around. R-D6/R-D7 land exactly, R-D8's two
   rates land at 0.180/0.120, R-D11–R-D15, R-D19 and R-D21 are untouched.
5. **Spec and docs.** `spec.md` R-D2 (new dates + the "runs past today" note), R-D3 (new counts),
   R-D4 rewritten around the workday range, the spend curve and the seat ceiling, **the R-D4
   collision paragraph struck**, R-D9's "150-day" and R-D21's seat-share argument corrected.
   `testing-spec.md` P5 and T-U22's "742". `technical-spec.md` R-T36 re-measured. `README.md`,
   `src/fixtures/README.md` (a new § on volume and the curve), `docs/positioning.md`, and
   `docs/adr/0009-scale.md` — every figure in the ADR re-derived, see below. **Landing figures
   untouched** (ticket 60's decision).
6. **Performance.** Measured before and after, below.

#### Fixture counts

| | before | after |
|---|---|---|
| rows on disk | 1,049 | **10,879** |
| visible roots (attempts) | 742 | **7,761** |
| visible children | 292 | **2,960** |
| hidden roots | 15 | **158** |
| Tasks | 570 | **5,970** |
| session Cost | $4,905.39 | **$55,293.74** |
| seat cost | $4,212.00 | $4,212.00 |
| seat share of Total spend | 46.2% | **7.1%** |
| median / p95 session cost | $3.64 / $20.32 | **$3.62 / $24.04** |
| sessions per human workday | — | **2.39 (Apr) → 4.20 (Sep)**, 2,043 pairs, all 1–9 |
| weekly session spend | 54 → 373 → 135 between adjacent weeks | **$1,581–$2,983**, worst departure from the curve 19.5% (week 0, ±40% band) |
| weeks repaired toward the curve | — | **2 of 24**, token scale 1.27–1.32 |

#### Before / after wall time

Measured on this branch, same machine, before any change and after all of them.

| | before | after | ratio |
|---|---|---|---|
| `pnpm test` | **11.20 s** (65 files, 1,515 tests) | **14.12 s** (65 files, 1,515 tests) | 1.26× |
| `PORT=3106 pnpm e2e` | **51.73 s** (179 tests) | **90.26 s** (179 tests) | 1.75× |
| `fixture-contract.test.ts` alone | 0.83 s | 1.93 s | **2.3×** |
| `readDataset()` p50/p95 | 8.20 / 9.51 ms | 75.13 / 81.02 ms | 9.2× |
| `spendPage()` p50/p95 | 23.83 / 24.66 ms | 211.23 / 217.26 ms | 8.9× |

Neither gate crossed 2×. **The contract test did, at 2.3×**, and it is noted under ADR-0009 § Consequences
rather than fixed here, as the ticket directs: it re-reads and re-validates the whole dataset once
per doctored case, so it is the one file whose cost is linear in the row count by construction, and
`test:mutation` re-runs the suite per mutant on top of that. `test:mutation` was **not** run — it
is not one of the six gates and a full Stryker sweep is hours; its cost tracks `pnpm test`, so the
inference is 1.26×.

ADR-0009 also gained a second note: `spendPage` is **20.2 µs per visible row**, and its 25 ms
budget line was taken off a 1,034-row measurement. At the ≤5,000 grouped rows the store would hand
over that stage is ~100 ms and the 10M-session read budget becomes **220 ms**, not 150 ms. The
store term and the seam are unaffected. Recorded, not fixed.

#### The six gates, from the worktree root

| gate | result | |
|---|---|---|
| `pnpm lint` | **pass** | eslint clean, no disables added |
| `pnpm typecheck` | **pass** | |
| `pnpm test` | **pass** | 65 files, **1,515 tests** |
| `pnpm test:coverage` | **pass** | statements 98.29%, branches 89.32%, functions 99.02%, lines 99.47%; every per-file threshold met |
| `pnpm build` | **pass** | |
| `PORT=3106 pnpm e2e` | **pass** | **179 tests** (chromium + mobile-chromium) |

#### Done-when: the unpinned clock

Verified with a throwaway Playwright config that starts `next dev` with `AGENT_DASH_NOW` deleted
from the spawned server's environment, and a spec that walks all six `/[org]` routes as the open
account. All six returned **200** with a non-empty `<main>`; on `/demo/history` every Started cell
was at or before the Madrid civil instant (`now = 2026-09-10 04:57`, newest row `2026-09-09 23:21`,
as-of stamp `2026-09-09 17:21`). The config and the spec were deleted after the run — they exist to
answer a Done-when bullet, not to be a seventh gate, and `playwright.config.ts`'s pin is untouched.

#### e2e literals made derived, or repointed

- **`e2e/queries` R-M18 / `e2e/gaps.spec.ts`.** Ticket 40's six bare weeks are gone: an account
  running one to nine sessions a workday finishes something in every week it works. In
  `src/data/queries.test.ts` the empty weeks are now **derived** — the weeks of the selected range
  the dataset holds no row in, read through the same planner the page uses — which at the pinned
  instant are the two the declared window offers past `now` (tickets 62 and 66 meeting). In
  `e2e/gaps.spec.ts` the case is the same account's `terraform-infra` work by week: **9 of 23
  weeks complete nothing and 3 of those 9 cost real money**, which is ticket 40's acceptance case
  intact, on a URL a reader can reach through R-C1's Repository filter.
- **`e2e/reading.spec.ts` T-E15 and `e2e/as-of.spec.ts`.** "The stamp equals the History top row"
  was a coincidence of the low-volume fixture. The stamp is the session that *ended* last printed
  at its **start** (ticket 45); the table is newest-first by **start**. At this volume a four-hour
  run that opened at 10:03 finishes after a half-hour one that opened at 12:51. Both tests now
  find the row **by the id the stamp carries**, assert its Started cell equals the stamp, and
  assert the ordering that does have to hold — which is what R-N3.1's checkability claim actually
  means.
- **`e2e/payload.spec.ts` / `e2e/support/costs.ts`.** The three named guard literals were
  re-derived (`24.39` → `28.04`, `7.31` → `24.87`, `0.7` → `0.8`), each re-measured for the
  property it is named for. A **fourth subtraction class** was added: `/demo/projection`
  extrapolates the viewer's own spend, and neither the daily rate nor today's remainder is a sum
  or a quotient at a reported key, so classes 1–3 could not see them — the leak was `15.5`, which
  is today's remainder *and* some other Member's session cost. The projection method is restated
  in `costs.ts` rather than imported, for the reason the whole module is. Residual set: **604 of
  1,653** candidate literals, against a floor of 300.
- **`e2e/people.spec.ts` counts were left literal.** Its 20s and its 6 are the *roster* — Members
  and the Platform team's membership — which this ticket does not change and which are more
  legible as literals. Nothing in that file is a session count.

#### Two latent bugs in the generator, found by the volume

Both were unreachable at 742 slots and silent at 7,761, and both are fixed with the reason in a
comment beside them:

- **Slots keyed by timestamp.** `trimLowUsage` kept R-D10's three sessions by `started_at_ms`, and
  `planTasks` chose which two-session Tasks are Rework the same way. At nine sessions per Member
  per workday two slots collide on the same second a handful of times per run, which would have
  kept a fourth session for the seat holder and mislabelled Decomposition Tasks as Rework. Both
  now key on **object identity**.
- **`distribute`'s three-session round-robin.** `threes[byVolume[i % length]] += 1` was correct
  while the whole fixture held sixteen `both`-shaped Tasks; at 129 of them it handed R-D10's
  three-session seat holder seven, and `cut` turned the negative remainder into Tasks with **no
  sessions**, which crashed `assign.mts`. It now skips a Member with no room, and `cut` throws
  rather than producing an empty group.

#### Escalations — decisions taken without asking, and what they cost

1. **`WEEKLY_SPEND_SHAPE`'s level is $1,900 → $2,650 per week, not the ticket's ~$450.** The
   ticket's figure is not reachable. Machine allocation is priced from the compute card and no
   token draw can move it: **~$1.95 per attempt**, so an April week of ~230 attempts costs ~$460
   in machine time before a single token is counted. The only fixture that reaches $450/week is
   one whose token spend is ~2% of what it is now, which would leave R-D16's "the frontier tier
   carries more token spend than any other tier" as a claim about $1,200 of a $16,800 bill and
   would make September's tokens-per-session fifty times April's. **Cheaper option taken:** keep
   the ticket's *shape* (logistic, plateau in August–September) and its *bands* (±40% / ±20%)
   exactly, and set the level to the fixture's own economics. **Cost:** the product's money
   figures are ~4× larger than the ticket imagined; total session spend is $55.3k over six months
   for eighteen developers, which is $512 per developer per month — high but not absurd for the
   volume R-D4 now asks for. Ticket 68 owns the token and cost distribution and can lower the
   level from here without touching the curve's shape. The arithmetic is written into
   `targets.mts` and `src/fixtures/README.md` so the next reader does not have to rediscover it.
2. **The curve's ratio is 1.39, not λ's 2.03.** Not a choice so much as a measurement, recorded
   because it looks like one: R-D17 makes the frontier tier's token share fall from 25% to 10%
   across the window against ADR-0007's 200× price spread, so spend per attempt falls ~30% while
   volume doubles. Authoring the ratio at 2.03 would have made the repair fire on most weeks and
   would have been a price ramp in all but name, which the ticket forbids.
3. **`LOW_USAGE_SESSIONS` held at 3.** The ticket permitted ≤12. At ~450 attempts for a busy peer,
   three is 0.7% of one — sharper than twelve — and it keeps **R-D10's own wording** ("fewer than
   5 sessions") true of the data, so no spec amendment beyond the three the ticket authorised.
   **Cost:** none identified. R-D10's seat holder is also now the *only* Member with an empty
   month, which is what `change.fixture.test.ts` needs for R-M12's floor; a new test asserts that
   uniqueness so a later ticket cannot take it away silently.
4. **`ADR-0008` and `ADR-0010` were not edited**, though both quote the 46.2% seat share. They are
   dated decision records and the figure is quoted as evidence for a decision taken on the day;
   ADR-0009 was edited because the ticket names it and because it is a live scale argument whose
   numbers are load-bearing. `docs/positioning.md` and `technical-spec.md` R-T36 *were* edited
   though the ticket does not name them, because each carried a claim that had become false rather
   than historical. **Cost:** a reader of ADR-0008 or ADR-0010 meets a stale percentage with no
   marker; both are dated 2026-09-09 and the spec they cite now says otherwise.
5. **The repair threshold is ¾ of the band, not the band.** `WEEKLY_SPEND_BAND.repairAt = 0.75`.
   The repair works on unrounded money over every row and the assertion works on whole-cent costs
   over roots carrying their children, so a repair aimed at the band edge could land a cent
   outside the thing it was trying to satisfy. Three quarters also keeps the fluctuation the
   requirement asks for — a late week still sits up to 14% off its trend — and makes the repair
   something the committed data exercises rather than dead code.

#### Left undone

- **Task titles repeat heavily.** `issues.mts` holds 10 subjects × 2–4 verbs per Repository, so
  5,970 Tasks draw from ~30 titles each — about 40 Tasks per distinct title, against 4 before.
  Visible on `/demo/history`. Out of scope here; noted for ticket 67, which owns the work mix.
- **`test:mutation` was not run.** Not a gate, and a full Stryker sweep is hours at this volume.

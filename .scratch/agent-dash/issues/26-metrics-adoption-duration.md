Type: implementation
Status: resolved
Blocked by: 23
Label: resolved

# Adoption metrics, duration, and the comparability intersection

## Goal

`src/domain/metrics/adoption.ts`, `metrics/duration.ts`, `domain/comparability.ts`.

## Scope

**Adoption (R-M9, R-M7).**

- **Tokens processed** = the four disjoint token classes summed. Disjointness is the property that
  makes the sum safe. It is an **adoption measure, never a cost proxy**, and is never presented
  beside a spend figure in a way that invites the inference.
- **Model mix** as a distribution at exact / family / tier. Exact → family → tier is a true
  partition and sums.
- **No per-session metric may be grouped by or filtered on Model** (A22). A session may span
  several Models, so doing so attributes one session's cost to one model unsoundly. Assert this as
  an **absence**: no query function accepts a Model argument. R-D15 puts 40% multi-Model sessions in
  the fixture, so this is a rule about real cases, not a hypothetical.

**Duration (R-M1, R-N14).**

- Session duration: **median and p95**. The distribution is right-skewed, so the mean is not
  meaningful — do not compute one, and assert the API does not expose one.
- **Human-presence spans**: the three disjoint spans sum exactly to
  `machine_allocation_duration_s`. `headless` sessions are 100% AFK with zero interactive and zero
  idle. The composition is computed over **`interactive` sessions only** — a view spanning both
  modes would merely rediscover which sessions were headless.

**Comparability (R-M8).**

The `WorkType → [artefact kind]` map is **data**, and comparability is its intersection, evaluated
here rather than enforced by convention inside a chart component. In the UI the dependency runs the
other way: **choosing a datapoint conditions which WorkTypes are offered** (A23), so an incomparable
selection is unrepresentable rather than rejected after the fact.

## Done when

**T-U4, T-U17, T-U18, T-U19, T-U20** pass.

## Notes

`review` produces only `pr_comment` and is comparable with neither of the code types — the one live
case the fixture keeps. `implementation`, `bugfix` and `refactor` share both artefact kinds and an
acceptance criterion, which is what keeps R-M6 true.

Agent execution time is **not separately recoverable** from the three spans, because the partition
is keyed on the human rather than on the actor doing the work. That is accepted, not a bug to fix.

## Comments

### 2026-09-08 — implemented (AFK build, wave 5, worktree `agent-dash-t26`)

Gates green: `lint` (0 errors; the one warning is ticket 29's pre-existing T-E4 TODO) · `typecheck`
· `test` (469 tests, +54) · `test:coverage` · `build`. All three new modules are **100%**
statements / branches / functions / lines against their per-file 95/90 gates. Nine files; no shared
module touched.

**`aggregate.ts`'s `modelMix` is reused rather than duplicated** — `tokenModelMix` delegates to it
and supplies only the measure, fixed to `tokensProcessed`, so a caller cannot substitute a cost
measure through it.

**T-U4.** The code types share all four artefact kinds, asserted both as the intersection and as the
offer. `review` produces `pr_comment` alone; `deploy` shares `commit` with the code types and
`pr_comment` with `review`; the three code types share an acceptance criterion while `review` and
`deploy` are each an acceptance set of one, which is what keeps R-M6 true. A "the map is data" test
rewrites the catalogue and shows every answer change.

**The comparability direction is the reverse of the obvious one, and is built that way.**
`ComparabilityDatapoint` is a discriminated union (`{measure: "artefact_count", artefact}` or
`{measure: "acceptance_rate", workType}`) and `offeredWorkTypes(map, datapoint)` returns the **set
of WorkTypes**. A UI builds its control from that set, so an incomparable selection has no
expression rather than being rejected after the fact (A23). **There is no exported boolean over a
pair**; `sharedArtefactKinds` returns the intersection itself as evidence for a caption, never a
verdict. The export surface is asserted to be exactly the three functions, so a validator arriving
later fails a test.

**T-U17.** One total at exact / family / tier, with each family re-summed from its exact slices and
each tier from its families — a stronger claim than equal grand totals. R-D16's 55/30/15 shares are
reproduced on committed rows and `frontier` holds the smallest token share. The *spend* half of
ADR-0007's invariant is deliberately **not** asserted here and is recorded as the generator's
(R-T23): this application prices nothing.

**T-U18.** The four classes summed, driven by `TOKEN_CLASSES`, with removing any one changing the
figure. That a cache read weighs the same as an output token is asserted as the accepted
consequence rather than left implicit. Disjointness on the fixture: 1091 of 1091 entries are
witnesses, 0 negative.

**T-U19.** Median and p95 on committed rows (742 sessions, 8512, 21293). The mean — 10020.36 — sits
above **460 of 742** sessions, which is the right-skew stated as a number rather than as prose.
Nearest-rank, so the even-sample median is 10 and not 15: interpolating *is* averaging two
observations, which is the thing R-M1 declines. `null` over an empty population, and no mean
anywhere.

**T-U20.** `spanFaults` finds nothing across 742 rows and the spans sum **exactly**, not within a
tolerance. All 263 headless rows are 100% AFK with zero interactive and zero idle. The composition
runs over 479 `interactive` sessions with 263 excluded, giving an AFK share of **0.346** where
spanning both modes gives 0.613 — A27's restriction as a measurable difference.

**"No query function accepts a Model" is asserted as an absence, two ways, and the pair turns out to
be necessary.** A compile-time `NamesAModel<Args>` type walks each export's `Parameters<>` for
`model | model_id | modelId | modelIds | family | tier` and pins every one to `false` with
`satisfies`, so `tsc` breaks the build on a Model parameter. A source-level scan in
`src/data/` (following `boundary.test.ts`'s precedent — reading source is legal below the domain
boundary) extracts every exported signature and asserts none names a Model. Both carry controls and
are asserted non-vacuous. Behavioural evidence too: 295 committed multi-Model sessions (39.8%),
each with a figure strictly greater than any one Model's contribution.

**Mutation-checked; six mutations, all caught**, every file restored byte-identical (SHA-256
verified). Two results are worth keeping:

| Mutation | Caught by |
|---|---|
| Composition over **all** sessions rather than `interactive` only | 9 tests |
| Add a `mean` **field** to `DurationSummary` | 8 tests — but **the export-surface scan did not fire**: a field is not a function |
| Export a `meanDuration` **function** | 1 test — only the export-surface scan |
| Make `review` comparable with `implementation` | 7 tests |
| Drop `cache_read` from the sum | 9 tests |
| Hide `model_id?` inside `AdoptionMix` (a filter leaving the signature text clean) | **typecheck only** — 0 runtime tests fired |

The last three lines are the finding: the two "mean" mutations are complementary and need different
guards, and a Model parameter hidden inside an object type is invisible to the source scan and
caught **only** by the compile-time pins. Neither guard alone is sufficient. Do not remove either
as redundant.

### Three things recorded, none re-decided

1. **T-U4's "`review` … comparable with neither of the others" is under-scoped.** Read literally it
   contradicts its own next bullet, which says `deploy` shares `pr_comment` with `review`. Read here
   as *the three code WorkTypes* — the only reading making both bullets true — with the reasoning
   recorded at the assertion. The test asserts `review`'s output peers are `{review, deploy}` and
   never a code type.
2. **"Session duration" and "machine allocation" are two definitions that coincide.** `CONTEXT.md`
   defines session duration as wall clock start→end and machine allocation as the time a machine
   was held. Duration is computed from the two stored instants, and the fixture test asserts it
   equals `machine_allocation_duration_s` on all 742 rows — so the coincidence is asserted rather
   than assumed.
3. **A23's "datapoint" is not defined as a type anywhere.** Modelled as artefact-kind-or-acceptance-
   rate, with acceptance rate carrying a WorkType because R-M6 makes a criterion-free acceptance
   datapoint meaningless. A modelling choice the spec leaves open.

Minor observation for whoever owns `aggregate.ts`: `Distribution` carries no `share` field, so every
consumer divides by `total` itself. Not worth changing under this ticket.

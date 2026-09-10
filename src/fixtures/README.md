# Fixtures

The committed dataset in `data/` and the seeded generator that produces it. **Tests read the
committed JSON and never run the generator** (P3 / R-T20): a test that regenerates its own input
tests the generator, not the data the application loads. CI regenerates into a temp directory and
diffs (R-T21 / T-F9).

```sh
pnpm fixtures:generate                 # rewrites data/
pnpm fixtures:generate --out /tmp/fx   # writes elsewhere, for the CI diff
```

`generate.mts` runs directly on Node 24 — no `tsx`, no build step. Relative imports between these
modules therefore carry the `.mts` extension.

## What is here

| File | Imitates | Notes |
|---|---|---|
| `data/sessions/<repo>__<work_type>.json` × 25 | Platform events | Timestamp-ordered. All 25 exist; `mobile-app__deploy.json` holds `[]` (R-D19). Roots and their children sit in the same file — a child inherits both labels |
| `data/members.json` | Mocked GitHub API | `{ github_users, members }` — the two sides of the join, and the join already applied |
| `data/teams.json`, `data/repositories.json`, `data/tasks.json` | Mocked GitHub API | GitHub field names, simplified envelope: no pagination, no `_links`, no unread fields |
| `data/work_types.json`, `data/models.json`, `data/rate_cards.json`, `data/organization.json` | Mocked internal API | Serialised as-is |

`Task` carries no `state`: the platform does not own the external issue's lifecycle
(`CONTEXT.md` § Work), so a resolved flag would be a claim the fixture is not entitled to make.

## The fan-out (R-D21, ADR-0008)

The platform is multi-agent, so ~20% of visible roots spawn one to four **child sessions**,
weighted toward `implementation` and `headless`. A child inherits its root's Task, Member,
Repository, WorkType and `execution_mode`, carries no `accepted`, and runs inside its root's
window. The application folds a child's cost, tokens and duration into its root at parse (R-M19),
so **session count means root count**: 7,761 attempts, 2,935 children, 158 hidden roots, 10,854
rows on disk, across 3,626 Tasks.

**`children.mts` runs last, and changes no root.** Everything upstream of it — the schedule, the
Task shapes, the cell assignment, the model draw, the hidden rows — runs exactly as it did before
children existed, so the roots are byte-identical apart from `parent_session_id`, and child ids
continue the sequence from the last root rather than renumbering it. R-D8's Rework and
Decomposition rates are *arrangements of roots* (`tasks.mts`), so they were hit without a single
target being retuned.

**A child is small in both dimensions at once.** Its machine allocation is 12–30% of its root's,
and its tokens are that same fraction of its root's own draw, taken per Model — scaling the
parcels rather than re-drawing them is what keeps R-D16's tier shares and R-D17's monthly trend
where `tokens.mts` put them, because a fan-out uses the models its root was already using. *(Until
ticket 66 the size was also argued from R-D4's seat share, which a bigger child would have diluted
out of an authored band. R-D4 no longer has that band — see below — and the sizing is now what it
should always have been: a sub-agent is handed one slice of its root's work.)*

Every distribution in `distributions.mts` and every money figure in `spend.mts` is asserted over
**roots carrying their children** (`tree.mts`), because that is the population the product reads.

## Every Job is reviewed, by somebody else (R-D22, ticket 67)

`reviews.mts`. The mix is three ratios against `implementation` — refactors 17%, bug fixes 29%,
reviews 122% of the three together — and a fourth term, `deploy`, which is not a taste call: it
is the level at which R-D6's WorkType marginal meets R-D7's Repository one. A population that is
two fifths `review` at 0.86 pushes the org-wide acceptance rate to 0.75, and R-D7's five rates
average 0.663 and top out at 0.78, so nothing on that side could have absorbed it. `deploy` at
0.34 is the only thing in R-D6 low enough to. 1.9552 deploys per implementation is where the two
meet; `WORK_MIX` in `targets.mts` carries the derivation, and `SHARE_TRANSFER_LIMIT` — re-checked
at this volume and left at 0.01 — now absorbs only the rounding.

**A review takes a slot off the schedule; it is not appended to one.** R-D4 draws one to nine
root sessions per human Member per workday and the volume ramp, the weekly spend curve and the
whole cell allocation are properties of exactly those slots. So `splitSlots` decides which of the
slots already drawn are reviews — evenly interleaved by rank, none in the first two days, nothing
else in the last one — and the review keeps that slot's Member and instant. R-D4's 2,043
(Member × workday) pairs are byte-for-byte what ticket 66 left.

The matcher is therefore a matcher and not a draw. Pass one hands every Job the earliest legal
slot behind it, preferring a team mate; pass two reads the leftover slots backwards for a Job in
a Repository that still owes a second review. **The band is ten minutes to four days**, not the
three the ticket asked for: a Job finished on a Friday morning has, inside three days, only
Friday's remaining slots and a weekend at 15% of a workday, and the matcher fails below 80 hours
on this schedule. The committed data runs a median delay of about 16 hours, 90% of reviews by a
team mate, and none by the author.

Two consequences are reported rather than corrected, and both are the model's own. A Task whose
implementation failed and whose review was submitted is a **Completed Task**, so the fixture no
longer holds a Member-month with spend and nothing delivered; the Incomplete population is now
carried by the Tasks that never left `deploy`, and R-D9's four age buckets are filled from there.
And `web-console` saturates: it has to average 0.78 while carrying a `deploy` column at 0.34, so
its other cells sit against their own counts. No cell is unanimous — `allocation.mts` caps every
one at its count less one — but `web-console` × `review` reads 99.9% and × `implementation` 99.2%.

**Task titles compose** (`issues.mts`), which is ticket 66's hand-over. A title is a verb, a
subject, and either an aspect (`the export dialog's empty state`) or, for a deploy, a destination
(`to the canary fleet`). Sixteen subjects and sixteen aspects per Repository are thirty-two
authored strings and several hundred phrases: 2,959 distinct titles over 3,626 Tasks, and no title
worn more than seven times against about forty before. `assertTitles` makes that a checked
property rather than an impression.

## Tokens: a floor, an appetite, and four leaders (R-D23, ticket 68)

`tokens.mts` draws one log-normal total per session — **median 1.1M, σ 1.1** — splits it into the
four disjoint classes by an authored mix (cache read 87.5%, cache write 7%, uncached input 3.5%,
output 2%), parcels those across Models and repairs to the month's Model targets. Three things
ticket 68 added sit on top of that draw.

**The floor is 75,000 tokens and it is applied to the session total, after the class split.** A
per-class floor would both miss the requirement — four small classes still sum below 75K — and
distort R-D16's class and tier shares. R-D11's ~20 CPU-heavy rows are the one exception, named in
the requirement: they are on `compute` for hours and draw a few thousand tokens, and a floor over
them would delete the thing they exist to show. `curve.mts` re-applies the floor after the weekly
repair, because a repair scale below one could otherwise take an 80K session under it — R-D23 is
a property of the fixture, not of the order two repairs ran in.

**A child is not floored, because a child is not an attempt.** It holds 12–30% of its root's
draw by construction (R-D21), so flooring one would either raise the root's floor to 625K — which
would delete a quarter of the session distribution — or break the fraction that keeps R-D16's
shares where `tokens.mts` put them. The floor is asserted over **roots**, hidden ones included.

**A Member's activity multiplies its token appetite.** The same multiplier R-D4's schedule draws
for session *count* is handed to the token draw, so a busy Member runs more sessions and bigger
ones; `generateSlots` returns it for exactly that reason. Four Members — `mem_ivazquez`,
`mem_dnavarro`, `mem_mpena`, `mem_aruiz` — carry a heavy-tail factor of ×7, ×6, ×10 and ×12 on
top. They are named rather than drawn so the ranking is stable across a regeneration, and the
factors differ because a tail of four identical Members reads as a bug.

The result is what `/demo/people` sorted by Tokens is for: **61.5B tokens over the window, a 2.1M
median attempt and a 33.3M p95, a median human Member-month of ~110M, and a busiest Member-month
of 2.2–3.2B — about thirty times the median one.** The four months lying wholly inside the window
read 99M / 76M / 139M / 110M at the median. *(Ticket 70 moved these by re-shaping the Model mix,
which re-fitted the weekly spend curve and so moved the token draw the curve repairs.)*

**One band is wider than the ticket asked for, and here is the arithmetic.** Ticket 68 asked for
80–130M in *each* full month — a range of 1.63×. The realised per-month medians span 1.75×, and
both causes are structural: R-D4's ramp takes the median human from 51 sessions in May to 78 in
August, and the appetite spread opens a gap in the middle of an 18-point sample exactly where its
median sits, so the month-to-month swing is larger than the ramp alone. No level of
`TOKEN_SESSION_MEDIAN` fits 1.75× inside 1.63×. So the ticket's band is asserted over the
**pooled** 70 Member-months of those four months, where a median is a statistic, and each month's
own median is held to ±45% of 100M.

## The GitHub → Member join (R-D20)

The join is **authored, not modelled**. It is applied by `people.mts` when the fixture is built,
re-applied by the invariant test over the committed JSON (T-F8), and it lives in one place:
`join.mts`. The rule, in order:

1. **Email.** The GitHub user's public email, trimmed and case-folded, against the Member's
   directory email. A `users.noreply.github.com` address is *not* an email for this purpose — it
   identifies an account, not a person — and falls through to the next rule.
2. **Full name, normalised.** Accents stripped, case folded, punctuation dropped, internal
   whitespace collapsed. `ALVARO RUIZ ORTEGA` and `Álvaro Ruiz Ortega` are the same person.

Four of the twenty users publish no email at all and two more publish only a `users.noreply`
address, so **six are carried by rule 2** and the fallback is exercised rather than decorative;
the generator asserts that at least four are, so a name edit cannot quietly retire it. **No GitHub user fails to match**, and the generator throws if
one does. An unmatched user is a real product problem that none of the six surfaces would show, so
modelling it would add an unreachable state to every aggregation.

**No two Members share a first name, and no surname token repeats in either position** (ticket
65), compared with accents folded away — a name in a legend or a ranked table names one person.
Nine of the eighteen humans carry one surname and nine keep the Spanish two-surname form, so no
surface may assume a three-word name; twelve names keep their accents, which is what stops rule 2's
fold below from being a no-op on the committed data. `invariants.mts` asserts all of it, and the
committed JSON is checked again by `invariants.test.ts`.

Member ids, directory email locals and GitHub logins are **not** re-derived from the names: they
identify rows the sessions already point at, so a rename moves labels and nothing else.

Logins deliberately do not read off the full names (`hcv-contract`, `mps-code`, `sibz`), so the
join is visibly doing work rather than being an equality check on a string the reader can see is
the same string (R-D1).

## Pricing lives here and nowhere else

The generator holds **both** rate cards and writes an attributed `cost` on every session (R-T22,
ADR-0005). The application prices nothing — there is no pricing function outside this directory.
The token card is serialised for display on `/demo/spend`; the compute card is serialised because
the generator uses it and is rendered nowhere (R-N11). The roster and the token card come from
[ADR-0007](../../docs/adr/0007-model-roster-spans-a-real-200x.md), not from ticket 16.

R-D16's headline is **derived, never hardcoded**: the generator computes the token spend share per
tier from the card and the tokens it actually emitted, and asserts the invariant — *the `frontier`
tier carries more token spend than any other tier while holding the smallest token share*. On the
committed data that comes out at **frontier 62.5% of token spend on 22.1% of tokens** (balanced
31.4%, fast 6.1%). Ticket 16's "~56%" was computed against a card ADR-0007 replaced.

The roster and the card come from [ADR-0011](../../docs/adr/0011-the-roster-grows-to-ten-and-the-mix-moves.md)
as of ticket 70: ten models in eight families, tiers 3/4/3, `gpt-5.2` verified at $1.75 input. The
200× spread is unchanged and is now reached by two frontier models against the same nano one.

## The presence that moves (R-D16, R-D17, ticket 70)

`targets.mts` no longer authors a tier split. **`FAMILY_SHARE_BY_MONTH` is the authored thing** —
eight families × six months, share of that month's tokens — and `tokens.mts` derives both the
per-Model targets and the tier shares from it and the roster. `TIER_TOKEN_SHARE` is gone; R-D16
survives as the *invariant* over what was emitted, which is where it always belonged.

The table is authored in **points** and normalised, because three of the six rows the human wrote
sum to 99 rather than 100. Normalising moves no family by more than 0.3 of a point, and the
generator asserts each realised share against the **authored** figure at ±2 points, so the
normalisation is inside the tolerance rather than hidden by it.

Two families hold two models and the split is inside them: `Claude Sonnet` hands over from
`claude-sonnet-4-6` to `claude-sonnet-5`, 70:30 in April to 5:95 in September, so the family line
is flat at ~30 points while the two exact lines cross; `OpenAI GPT-5` divides evenly between
`gpt-5-nano` and `gpt-5.2`, which is not a story the human authored and is the cheapest thing that
is not a claim (ticket 70's `## Comments`). **`OpenAI GPT-5` therefore straddles two tiers**, and a
tier is summed from its Models rather than from its families everywhere in this repository.

The committed result: **Anthropic 58.0% of tokens, OpenAI 31.9%, Google 10.1%** over the window
against a 60 / 30 / 10 target at ±3; frontier rising **11.6% → 31.5%** April to September and
`claude-haiku-4-5` fading **28.0% → 10.3%**; **61.5B tokens** in all.

**Reversing R-D17 re-fitted the spend curve and nothing else.** `WEEKLY_SPEND_SHAPE` used to be
*shallower* than the volume curve because the average priced token got cheaper across the window;
it now gets dearer — ~0.68¢ to ~1.21¢ per thousand — so the curve is steeper (1,600 → 5,700 per
full week, ~$1,666 at the open and ~$5,138 at the close) and carries its own midpoint and
steepness: volume flattens across August and the mix does not, so a logistic sharing λ's midpoint
cannot follow their product. Three of the twenty-four weeks are repaired onto it, which is exactly
where ticket 66 left the count, and the worst surviving departure is 29.9% against a ±40% band.
There is still no price ramp in this directory: the price ramp is the Model mix.

## How the shape is hit

The requirements in `spec.md` § 8 are not sampled and hoped for; each is either constructed or
repaired, and then asserted (R-T23). The generator throws rather than writing a fixture that has
quietly lost one of them.

- **Acceptance rates.** R-D6 (by WorkType) and R-D7 (by Repository) are two marginals of one
  table, so they have to agree on the grand total. `allocation.mts` solves that agreement by
  moving a small slice of session share between `review` and `deploy` — the two ends of R-D6 —
  and asserts the transfer stays under 0.01, so the authored mix survives. The cell table is then
  filled by raking and drained exactly by `assign.mts`, which is why both rates land within one
  session of their targets.
- **Rework and Decomposition** are *arrangements*, not fields: a Task is Rework if a non-accepted
  session was followed by another, Decomposition if more than one session was accepted. They are
  independent labels, so the overlap is the product of the two rates. Both are read over the
  Task's **non-review** sessions — see "Every Job is reviewed" below.
- **Model mix.** Models are drawn against each month's per-Model targets — the family table split
  within each family — and then repaired by moving whole parcels between models until the realised
  shares match. A size-ordered assignment would hit the targets exactly but would correlate model
  with session size — a finding the fixture would be inventing.
- **Timezone.** Every timestamp is Madrid local with its offset, and the generator verifies the
  offset against `Intl` on every row rather than trusting that no DST transition falls in the
  window. See the note below.

## Volume, and the curve spend follows (R-D4, ticket 66)

**On a workday each human Member runs `1 + Poisson(λ(t)·activity)` root sessions, capped at
nine**; a weekend day runs about 15% of that rate and is usually empty. λ is a logistic in window
fraction rising from ~1.5 in April to ~4 by September and flattening across August, and the
per-Member activity multipliers are normalised to mean 1 over the humans, so λ alone fixes the
organisation-wide rate. The committed data holds **2,043 (human Member × workday) pairs, every
one of them inside 1–9**, at 2.39 sessions per human workday in April rising to 4.20 in September.
The two service accounts keep the *weekly* zero-inflated Poisson the whole fixture used before
ticket 66, scaled ×3: a nightly runner has no workday.

**R-D10's seat holder is carved out afterwards** and stays at three sessions — 0.7% of a busy
peer's — which is what keeps R-D10's own "fewer than 5 sessions" true of the data.

**Weekly session cost follows `WEEKLY_SPEND_SHAPE`**, a logistic in dollars: ~$1,666 in the
opening week rising to ~$5,138 in the closing one. `curve.mts` spreads it over a week's own days,
so the six-day closing bucket — which still holds five workdays — is targeted at 97% of a full
week rather than at six sevenths of one. A week that drifts past three quarters of its band has
that week's **token draws** scaled until it lands on the curve; a week inside it is left exactly
as drawn, which is where the fluctuation comes from. Three of the twenty-four weeks are repaired
on the committed data, and the worst surviving departure is 29.9% against a ±40% band.

**The level moved with ticket 68's token scale; the *shape* moved with ticket 70's Model mix.**
Ticket 68 re-fitted the level to what the draw actually produced (2,050 / 2,860 against 1,900 /
2,650), because a level ~30% under the draw would have had the repair pulling two weeks in three
back onto the curve and R-D23's Member-months would then be a property of `curve.mts` rather than
of the draw. Ticket 70 then reversed R-D17, which is the only thing that ever decided this curve's
*shape*: with the mix getting dearer instead of cheaper the trend is 1,600 / 5,700 at midpoint
0.65 and steepness 6.5 — its own rather than λ's, because volume flattens across August and the
mix does not, so their product keeps rising where a logistic on λ's midpoint has stopped. The
bands, the repair threshold and the repair count (3 of 24) are untouched.

**The curve is steeper than the volume curve — ~3.1 against λ's 2.03 — and R-D17 is the whole of
the difference.** It was shallower until ticket 70, when the frontier tier's share stopped falling
and started rising; see "The presence that moves" above. There is still no separate price ramp
anywhere in this directory.

**One number is authored above where the ticket asked for it, and here is the arithmetic.** Ticket
66 specified ~$450/week in April. Machine allocation is priced from the compute card and no token
draw can move it: it is ~$1.95 per attempt, so an April week of ~230 attempts costs ~$460 in
machine time before a single token is counted. $450 is below that floor, and the only fixture that
reaches it is one whose token spend is a rounding error — which would make R-D16's "the frontier
tier carries more token spend than any other" a claim about $1,200 of a $16,800 bill. The *shape*
and the *bands* are the ticket's; the *level* is the fixture's own.

## Two places the fixture does not simply transcribe a spec

Both are reported rather than resolved, and no spec was edited.

- **R-D5's stated consequence does not hold at UTC+2.** The requirement asks for sessions between
  22:00 and 24:00 Europe/Madrid "so they land on the previous UTC day". At +02:00 they do not —
  23:00 Madrid is 21:00 UTC, the same date. The rows whose UTC date really differs are the ones
  just after local midnight. **Both slices are seeded**: the 22:00–24:00 rows because R-D5 and
  T-F6 name them, and the 00:00–02:00 rows because those are what a UTC-bucketed query would put
  in the wrong period.
- **The seat-cost finding was demoted, not preserved** (ticket 66). It used to be the sharpest
  figure in the product at ~46% of Total spend, and the fixture was held at ~750 attempts so that
  it would be. R-D4 now asks for one to nine sessions per human Member per workday, and the
  committed data carries **$72,682.16 of session spend against $4,212.00 of seat cost — 5.5% of
  Total spend**, asserted as a *ceiling* of 25% rather than as a band. The median session cost is
  $3.28 and the p95 $35.14 (ticket 70's dearer mix moved both); no band is asserted over either, because ticket 66 deleted the
  authored one with the fixture that produced it and ticket 68 — which set the token and cost
  distribution — did not author a new one: R-D23 states the distribution in *tokens*, and the
  money is the rate card applied to it.
  *(Ticket 10's median ~$3.20 / p95 ~$35 pair was withdrawn in the spec on 2026-09-09 and its
  governing paragraph struck on 2026-09-10; nothing here now contradicts it.)*

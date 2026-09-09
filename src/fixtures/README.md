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
so **session count means root count**: 742 attempts, 292 children, 1,049 rows on disk.

**`children.mts` runs last, and changes no root.** Everything upstream of it — the schedule, the
Task shapes, the cell assignment, the model draw, the hidden rows — runs exactly as it did before
children existed, so the roots are byte-identical apart from `parent_session_id`, and child ids
continue the sequence from the last root rather than renumbering it. R-D8's Rework and
Decomposition rates are *arrangements of roots* (`tasks.mts`), so they were hit without a single
target being retuned.

**A child is small in both dimensions at once.** Its machine allocation is 12–30% of its root's,
and its tokens are that same fraction of its root's own draw, taken per Model — scaling the
parcels rather than re-drawing them is what keeps R-D16's tier shares and R-D17's monthly trend
where `tokens.mts` put them, because a fan-out uses the models its root was already using. The
size is also what protects R-D4: session spend rose 8.4% and the seat share moved from 48.2% to
46.2%, still inside its authored band.

Every distribution in `distributions.mts` and every money figure in `spend.mts` is asserted over
**roots carrying their children** (`tree.mts`), because that is the population the product reads.

## The GitHub → Member join (R-D20)

The join is **authored, not modelled**. It is applied by `people.mts` when the fixture is built,
re-applied by the invariant test over the committed JSON (T-F8), and it lives in one place:
`join.mts`. The rule, in order:

1. **Email.** The GitHub user's public email, trimmed and case-folded, against the Member's
   directory email. A `users.noreply.github.com` address is *not* an email for this purpose — it
   identifies an account, not a person — and falls through to the next rule.
2. **Full name, normalised.** Accents stripped, case folded, punctuation dropped, internal
   whitespace collapsed. `ALVARO RUIZ ORTEGA` and `Álvaro Ruiz Ortega` are the same person.

Four of the twenty users publish no usable email and are carried by rule 2, so the fallback is
exercised rather than decorative. **No GitHub user fails to match**, and the generator throws if
one does. An unmatched user is a real product problem that none of the six surfaces would show, so
modelling it would add an unreachable state to every aggregation.

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
committed data that comes out at **frontier 49.9% of token spend on 14.6% of tokens** (balanced
44.5%, fast 5.6%). Ticket 16's "~56%" was computed against a card ADR-0007 replaced.

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
  independent labels, so the overlap is the product of the two rates.
- **Model mix.** Models are drawn against each month's targets and then repaired by moving whole
  parcels between models until the realised shares match. A size-ordered assignment would hit the
  targets exactly but would correlate model with session size — a finding the fixture would be
  inventing.
- **Timezone.** Every timestamp is Madrid local with its offset, and the generator verifies the
  offset against `Intl` on every row rather than trusting that no DST transition falls in the
  window. See the note below.

## Two places the fixture does not simply transcribe a spec

Both are reported rather than resolved, and no spec was edited.

- **R-D5's stated consequence does not hold at UTC+2.** The requirement asks for sessions between
  22:00 and 24:00 Europe/Madrid "so they land on the previous UTC day". At +02:00 they do not —
  23:00 Madrid is 21:00 UTC, the same date. The rows whose UTC date really differs are the ones
  just after local midnight. **Both slices are seeded**: the 22:00–24:00 rows because R-D5 and
  T-F6 name them, and the 00:00–02:00 rows because those are what a UTC-bucketed query would put
  in the wrong period.
- **Ticket 10's session-cost figures are not jointly reachable.** Median ~$3.20 with p95 ~$35
  implies a mean near $9 and a window total near $6,900, which contradicts R-D4's ~$4,500 of
  session spend and its ~48% seat share. R-D4 is in the spec and wins: the committed data carries
  a median of $3.44 and a p95 of $18.42, with $4,523.63 of session spend against $4,212.00 of seat
  cost — **48.2% of Total spend**. Ticket 48's fan-out then added 8.4% of session spend on top: the
  committed data now carries a median of $3.64 and a p95 of $20.32, with $4,905.39 of session
  spend against the same $4,212.00 of seat cost — **46.2% of Total spend**.

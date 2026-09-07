Type: implementation
Status: ready-for-agent
Blocked by: 23
Label: ready-for-agent

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

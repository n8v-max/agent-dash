# ADR-0004: Repository carries no work-domain label

Date: 2026-09-07
Status: Accepted

Decided in [ticket 16](../../.scratch/agent-dash/issues/16-work-domain-and-model-roster.md).

## Context

The map charted Repository as a first-class aggregation dimension **carrying a work-domain
label** — mobile, data science, backend, frontend, infrastructure config. Ticket 16 existed to
name that label's values. It has instead removed the label.

The argument for it was strong and is worth stating, because it is the argument this ADR
declines. Ticket 15 recorded that **no surveyed vendor offers any grouping above Repository**,
and that Stanford's segmentation puts the agent effect at +30–40% on low-complexity greenfield
work and **net negative** on high-complexity work in large mature codebases. An org-level
aggregate that does not condition on the nature of the work averages across populations with
opposite signs. The dimension was there to stop that.

## Decision

**Repository is flat. It carries no work-domain label and no roll-up level.** The nature of the
work is expressed by `Repository × WorkType`, which the product already carries as two page
filters on every analytical surface.

## Why

**One label per repository would be false.** A real repository runs several technologies at
once. `api-gateway` is backend and infrastructure and, through its client SDK, frontend. Forcing
a single value invents a fact; allowing several breaks additivity on every chart grouped by it,
because a roll-up level is a partition by definition.

**`Repository × WorkType` already separates the two Stanford populations.** That is the standard
ticket 16 set for the vocabulary, and the pair meets it without a new column.

**The signal survives in the repository name.** A reader looking at acceptance rate by repository
sees `web-console` at 0.78 and `terraform-infra` at 0.44 and draws the conclusion. The finding is
discovered, not read off an axis label.

## Consequences

- `CONTEXT.md` § Organisation & People and § Aggregation Dimensions lose the label.
- **`Cohort` is cut entirely.** Its key was work domain, WorkType, or both. With the filter set
  fixed at `Repository × Team × WorkType` on every page, `Cohort` named nothing the filters do
  not already name. It had already been demoted once, from an access scope to an aggregation
  dimension, by ticket 12.
- **There is no grouping above Repository.** With five repositories that is comfortable. At fifty
  it would not be, and this is the decision to revisit first if the repository count grows.
- Repository names become load-bearing. They are chosen so the technology reads off the name.

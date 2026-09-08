Type: implementation
Status: ready-for-agent
Blocked by:
Label: ready-for-agent

# ADR-0009 — what changes at ten million sessions

## Scope

One page. State: today everything is in-process over a static fixture. At 10M sessions per org
per year the seam holds because the domain reads pre-aggregated rows at (day × member × repo ×
work_type × model) grain; History alone reads raw rows, paginated. Name where the pre-aggregation
runs, what stays computed at request time (ratios, top-N, change), and the one query that does
not fit that grain (Rework, which needs Task grouping) and how it is served. Give one number per
claim: row counts, expected p95 for a Spend page read.

## Done when

`docs/adr/0009-scale.md` exists, linked from README.

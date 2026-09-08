Type: implementation
Status: ready-for-agent
Blocked by: 45
Label: ready-for-agent

# `docs/ingest.md` — where sessions come from

## Scope

One page with one diagram (Mermaid). Platform emits a session-ended event; billing attributes
cost (ADR-0005); an ingest worker upserts by session id (idempotent); a nightly job rebuilds the
pre-aggregates. State the latency budget from session end to dashboard, the as-of timestamp
(ticket 45) as the observable, and what a late or duplicate event does. Three failure modes:
billing lag, mid-month rate change, a session with no tracker key. For each, what the dashboard
shows.

## Done when

File exists, linked from README and from ADR-0009.

Type: research
Status: ready-for-human
Priority: HIGH — BLOCKER

# Metrics sign-off

## Question

Are the proposed dashboard metrics correct, complete, and weighted right for the target personas?

## Proposed metric set

**Overview** (all roles)
- Total sessions, total tokens, total cost — vs prior period (% Δ)
- Sessions-over-time sparkline (7d / 30d / 90d toggle)
- Success rate gauge (completed vs failed vs interrupted)
- Top 3 most active members (admin/viewer) or personal rank (member)

**Usage** (role-scoped)
- Sessions by day/week bar chart
- Median + p95 session duration
- Token breakdown stacked bar (input / output / cache_read / cache_write)
- Filters: date range, team (admin), template type

**Cost** (role-scoped)
- Total cost trend line
- Cost per member ranked list (admin only)
- Cost per team bar chart (admin only)
- Projected month-end spend

**Members** (admin only)
- Table: member, team, sessions, tokens, cost, last active, role

## Decision needed

Confirm, edit, or replace the proposed set. Once signed off, the fixture schema (05) can be designed.

## Blocked by

Nothing — this is the root blocker.

## Blocks

05 (fixture schema), and indirectly everything downstream.

## Comments

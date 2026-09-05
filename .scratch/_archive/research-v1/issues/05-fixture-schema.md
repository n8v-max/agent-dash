Type: research
Status: ready-for-human
Blocked by: 03

# Design fixture data schema (shape, variance, seed script)

## Question

What is the exact shape of the static JSON fixtures that will power the entire dashboard?

## Scale (settled)

1 org, 4 teams, 20 members, 180 days of history.

## Open decisions

1. **Grain**: one row per session event, or pre-aggregated daily counts?
   - Per-session gives maximum filter flexibility; pre-aggregated is simpler to query in-browser.
   - Recommendation: hybrid — raw sessions for Members table + per-day rollups for charts.

2. **Cost field**: pre-computed on each session record, or derived at read time from token counts?
   - Recommendation: pre-computed (store `cost_usd` on each session; pricing formula is fixed).

3. **Template names**: confirm or replace the placeholder set (code-review, bug-fix, test-gen, refactor, doc-gen, dependency-update). See ticket 07.

4. **Variance patterns**: what makes the fixture data feel realistic?
   - Success rate: ~85% completed, ~10% failed, ~5% interrupted
   - Duration: median 4m, p95 18m, right-skewed
   - Token range: input 2k–80k, output 500–20k, cache varies by template
   - Cost: $0.02–$4.50 per session depending on token count

5. **Seed script**: generate fixtures with a fixed random seed so tests are deterministic.

## Blocked by

03 (metrics sign-off must be complete before schema is finalised)

## Comments

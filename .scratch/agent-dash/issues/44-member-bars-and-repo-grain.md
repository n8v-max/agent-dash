Type: implementation
Status: ready-for-agent
Blocked by: 40
Label: ready-for-agent

# Subject = Member draws ranked bars; Cost by Repository reads months

## Goal

Five overlapping lines plus "Other" is unreadable. Twenty-three groups of five bars is unreadable.

## Scope

1. **Subject = Member** on every time-series panel renders one horizontal bar per Member for the
   selected period, sorted by the panel's measure, top-N plus "Other" as today. No time axis at
   Member subject. Table mirror is one row per Member.
2. **Cost by Repository** ignores the page grain and reads months, with the same one-line note
   Total spend uses.
3. Chart frame gains a `form: "series" | "ranked"` input so the query, not the panel, chooses.

## Done when

- Unit: ViewModel for `subject=member` carries `form: "ranked"` and rows sorted descending.
- e2e: `/demo/spend?subject=member` renders no `<path>` line series and one bar per Member.
- e2e: `/demo/spend?grain=week` Cost by Repository mirror has month keys.

## Notes

Decided by the human, 2026-09-09, rounds 2 and 3.

Type: implementation
Status: ready-for-agent
Blocked by: 22
Label: ready-for-agent

# Change floor and series capping

## Goal

`src/domain/change.ts` and `src/domain/series.ts` — the two rules that shape every chart in the
product.

## Scope

**Change floor (R-M12).** A change figure is suppressed **only when the prior period holds nothing
at all**. The floor is a count of one, **not a magnitude threshold**.

- Prior period zero → suppressed. Prior period one → shown, however large.
- Two-to-three sessions week-over-week really is +50%, and on a narrow self-view that is the honest
  reading, not noise.
- A test asserting a percentage cut-off encodes the position ticket 05 explicitly rejected. Every
  vendor shipping a magnitude floor ships it to gate **alerts**, and alerting is out of scope here.

**Series cap (R-V4, R-V5, R-V6, R-V7).**

- Top 4 + "Other", **engaging only above five series**. 20 Members → 4 + "Other"; 5 Repositories →
  5 and **no** "Other". An "Other" bucket holding one repository reads as a rendering fault. See
  `spec.md` § 11 C1 — this resolves a conflict between tickets 07 and 10 in favour of the later.
- Ranked by the chart's own measure **across the whole selected range**, then bucketed. Ties break
  by name ascending.
- The set is **identical in every bucket**, recomputed only when range, filters or roll-up level
  change. Per-bucket ranking is forbidden: it makes series identity change mid-chart, which is both
  misleading and the exact input that triggers the `key={index}` legend bug.
- **"Other" is inert** — not clickable, does not expand. Its tooltip lists what it holds.
  **Filtering is how a viewer reaches beyond the top four; the cap never lifts.**
- Four plus "Other" fills `--chart-1..5` exactly. **The palette is never extended** — no
  `--chart-6..N`, no OKLCH generation. Nothing can request a sixth colour, so the silent
  transparent-series failure is unreachable by construction.

## Done when

**T-U3** and **T-U11** pass. T-U11 must include a dataset where per-bucket ranking would differ
from whole-range ranking, asserting the whole-range answer.

## Notes

The cap is the better chart independently of the palette bug: categorical palettes run out of
distinguishable hues around 10–12, so a 20-series chart is unreadable whether or not it is coloured.
Extending the theme would have made a bad chart render instead of making it a good chart.

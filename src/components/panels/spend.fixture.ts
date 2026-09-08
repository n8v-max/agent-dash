// The `/demo/spend` ViewModels the panel tests render, authored by hand.
//
// **They are literals, not queries** — the same reason `chart-viewmodels.fixture.ts` gives:
// `src/components/**` may import `src/domain` for types only (R-T6), so a component test cannot
// call `spendPage()` to build its input and should not want to. What a panel owes is "render the
// ViewModel you were handed, faithfully". Whether the ViewModel is *correct* — that Total spend
// reads months whatever the page grain is (R-M5, A25), that a ratio is never `stackable` (R-V1),
// that the mirror was summed independently of the series (R-T7) — is asserted in
// `src/domain/**` and `src/data/**`, over the real functions and the committed fixture.
//
// **The grains here are deliberately mixed.** Every panel but Total spend carries the page's
// weekly buckets; Total spend carries months, because that is the shape A25 forces on it. A
// panel that quietly re-bucketed would show up as months where weeks were handed over.

import { chartFixture } from "@/components/charts/chart-viewmodels.fixture";
import type {
  AdoptionSection,
  DistributionViewModel,
  RateCardViewModel,
  SpendPageViewModel,
} from "@/data/queries";

/** The page grain in these fixtures: `/demo/spend` opens at week (R-C4, `params.ts`). */
export const WEEK_BUCKETS = ["Week 18, 2026", "Week 19, 2026", "Week 20, 2026"];

/** What Total spend carries instead, whatever the page grain is (R-M5, A25). */
export const MONTH_BUCKETS = ["Apr 2026", "May 2026", "Jun 2026"];

/** The note the ViewModel carries on the Total spend panel — R-M5's reason, in its words. */
export const MONTHLY_NOTE =
  "Total spend is reported monthly whatever the page grain is: a seat fee apportioned across " +
  "days is invented precision, so the figure exists at monthly grain and coarser only.";

/** R-N9's one line for the Adoption section. */
export const ADOPTION_STATEMENT =
  "These measure use, not money: tokens processed is an adoption measure and never a cost proxy.";

/** R-V3's sentence, as a Team roll-up would carry it. Rendered by `ChartFrame`, once. */
export const OVERLAP_NOTE =
  "Members may belong to more than one Team, so these Team totals overlap and do not sum to the Organization's.";

/**
 * The three levels name different things — that is what makes `levels[level]` a lookup worth
 * asserting: a panel reading the wrong one would render Model families where tiers were asked
 * for, and identical fixtures would hide it.
 */
const LEVEL_SLICES: Readonly<Record<DistributionViewModel["level"], readonly [string, string]>> = {
  exact: ["claude-opus-5", "claude-sonnet-5"],
  family: ["claude", "gpt"],
  tier: ["frontier", "workhorse"],
};

const distribution = (level: DistributionViewModel["level"]): DistributionViewModel => ({
  level,
  slices: [
    { key: `${level}-first`, label: LEVEL_SLICES[level][0], value: 4_000_000, share: 0.4 },
    { key: `${level}-second`, label: LEVEL_SLICES[level][1], value: 6_000_000, share: 0.6 },
  ],
  total: 10_000_000,
  stackable: true,
});

export const rateCardFixture = (): RateCardViewModel => ({
  label: "Illustrative rates — real input prices, derived cache and output classes",
  unit: "usd_per_million_tokens",
  currency: "USD",
  table: {
    columns: [
      { key: "model", label: "Model", numeric: false, sortable: false },
      { key: "uncached_input", label: "Uncached input", numeric: true, sortable: false },
      { key: "cache_read", label: "Cache read", numeric: true, sortable: false },
      { key: "cache_write", label: "Cache write", numeric: true, sortable: false },
      { key: "output", label: "Output", numeric: true, sortable: false },
    ],
    rows: [
      { key: "claude-opus-5", cells: ["claude-opus-5", 5, 0.5, 6.25, 25] },
      { key: "claude-sonnet-5", cells: ["claude-sonnet-5", 2, 0.2, 2.5, 10] },
    ],
    sort: { column: "model", direction: "asc" },
    empty: false,
    note: null,
  },
  derivation: [
    { key: "uncached_input", factor: 1 },
    { key: "cache_read", factor: 0.1 },
    { key: "cache_write", factor: 1.25 },
    { key: "output", factor: 5 },
  ],
});

export const adoptionFixture = (): AdoptionSection => ({
  heading: "Adoption",
  statement: ADOPTION_STATEMENT,
  tokensOverTime: chartFixture({
    title: "Tokens processed over time",
    rollUpLevel: "Organization",
    buckets: WEEK_BUCKETS,
    series: [{ key: "organization", label: "Northwind", values: [3_000_000, 4_000_000, 3_000_000] }],
  }),
  volume: {
    processed: 10_000_000,
    byClass: {
      uncached_input: 3_000_000,
      cache_read: 4_000_000,
      cache_write: 1_000_000,
      output: 2_000_000,
    },
    entries: 812,
  },
  modelMix: {
    level: "family",
    chart: chartFixture({
      title: "Model mix",
      rollUpLevel: "Model (family)",
      buckets: WEEK_BUCKETS,
      series: [
        { key: "claude", label: "claude", values: [2_000_000, 2_500_000, 1_500_000] },
        { key: "gpt", label: "gpt", values: [1_000_000, 1_500_000, 1_500_000] },
      ],
      stackable: true,
    }),
    levels: {
      exact: distribution("exact"),
      family: distribution("family"),
      tier: distribution("tier"),
    },
    total: 10_000_000,
  },
  rateCard: rateCardFixture(),
});

/**
 * A whole `/demo/spend` ViewModel, at Organization roll-up — the page's default subject.
 * Override one field to make a panel empty, or to put a Team grouping's overlap note on it.
 */
export const spendPageFixture = (
  overrides: Partial<SpendPageViewModel> = {},
): SpendPageViewModel => ({
  orgSlug: "northwind",
  // C14 — off by default, which is what a bare route renders (R-C4).
  perCapita: { on: false, denominator: 18, available: true },
  costPerCompletedTask: chartFixture({
    title: "Cost per completed Job",
    rollUpLevel: "Organization",
    buckets: WEEK_BUCKETS,
    series: [{ key: "organization", label: "Northwind", values: [51.4, 47.9, 55.2] }],
  }),
  totalSpend: {
    chart: chartFixture({
      title: "Total spend",
      rollUpLevel: "Organization",
      buckets: MONTH_BUCKETS,
      series: [
        { key: "session", label: "Session cost", values: [4100, 4600, 4300] },
        { key: "seat", label: "Seat cost", values: [1200, 1200, 1200] },
      ],
      stackable: true,
    }),
    sessionCost: 13_000,
    seatCost: 3600,
    total: 16_600,
    seats: 20,
    seatMonths: 60,
    seatShare: 0.2168,
    partial: true,
    note: MONTHLY_NOTE,
  },
  costPerSession: {
    chart: chartFixture({
      title: "Cost per session",
      rollUpLevel: "Organization",
      buckets: WEEK_BUCKETS,
      series: [{ key: "organization", label: "Northwind", values: [9.4, 10.1, 8.8] }],
    }),
    outcome: "accepted",
    range: {
      key: "range",
      partial: false,
      outcome: "accepted",
      sessions: 1412,
      // 1412 × 9.2, so the panel's three figures are arithmetically consistent — and distinct
      // from the Total spend panel's session Cost, which a shared literal would confuse.
      cost: 12_990.4,
      value: 9.2,
      message: null,
    },
  },
  costPerCompletedTaskByWorkType: chartFixture({
    title: "Cost per completed Job by template",
    rollUpLevel: "WorkType",
    buckets: WEEK_BUCKETS,
    series: [
      { key: "implementation", label: "Implementation", values: [61.2, 58.4, 63.9] },
      { key: "review", label: "Review", values: [12.1, 13.4, 11.8] },
    ],
  }),
  costByRepository: chartFixture({
    title: "Cost by Repository",
    rollUpLevel: "Repository",
    buckets: WEEK_BUCKETS,
    series: [
      { key: "repo_api", label: "api-gateway", values: [1900, 2100, 1800] },
      { key: "repo_web", label: "web-client", values: [1400, 1500, 1300] },
    ],
  }),
  adoption: adoptionFixture(),
  ...overrides,
});

// T-U11 against the **committed** fixture (R-V4…R-V7, A13, A14, P3, P6).
//
// The pure unit tests live in `src/domain/series.test.ts` and author every row inline, because
// `src/domain/**` may not reach the data layer (R-T5). This file sits outside that boundary, so
// it may import `load.ts` — and it exists because P6 says a test that would pass against an
// empty fixture is not a test.
//
// **The committed fixture is itself the dataset T-U11 asks for.** Ranked by session count over
// the whole window the four largest Members are Héctor Camps, the Nightly Runner, Silvia Roldán
// and the Deploy Bot; ranked inside April alone they are the Nightly Runner, Irene Vázquez,
// Rubén Marín and Diego Navarro. **Three of the four differ.** A per-bucket ranking would
// therefore rewrite three fifths of the legend between April and May on real rows, which is the
// bug R-V5 exists to prevent — and the whole-range answer is what this file asserts.
//
// R-D3 seeds the 20 Members the cap bites on and the 5 Repositories it must not bite on, so A13
// is asserted here in both halves, on the rows the product actually ships.
//
// It reads committed output and never runs the generator (P3, R-T20). It follows the precedent
// `periods.fixture.test.ts` set for the same reason.

import { describe, expect, it } from "vitest";
import { membershipFromTeams } from "@/domain/access";
import { bucketRows, planPeriods, type PeriodBucket, type PeriodRange } from "@/domain/periods";
import {
  CHART_COLOR_VARS,
  NAMED_SERIES_CAP,
  OTHER_SERIES_KEY,
  SERIES_LIMIT,
  capSeries,
  type SeriesSet,
} from "@/domain/series";
import type { AgentSession } from "@/domain/types";
import { loadDataset } from "./load";

const { organization, members, teams, repositories, workTypes, models, sessions } = loadDataset();

const WINDOW: PeriodRange = { start: organization.window_start, end: organization.window_end };
/** The last instant of the fixture window, in the Organization's timezone. P5: never a clock read. */
const NOW = `${organization.window_end}T23:59:59+02:00`;

const monthBuckets = (): readonly PeriodBucket<AgentSession>[] => {
  const result = planPeriods({
    timezone: organization.timezone,
    grain: "month",
    range: WINDOW,
    now: NOW,
  });
  if (!result.ok) throw new Error(`plan unexpectedly rejected: ${result.reason}`);
  return bucketRows(result.plan, sessions);
};

const MONTHS = monthBuckets();
const MONTH_KEYS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

const one = (): number => 1;
const cost = (session: AgentSession): number => session.cost;

const nameOf = new Map(members.map((member) => [member.id, member.full_name]));
const repositoryName = new Map(repositories.map((repository) => [repository.id, repository.name]));

const byMember = (measure: (session: AgentSession) => number): SeriesSet =>
  capSeries({
    buckets: MONTHS,
    seriesKeysOf: (session) => [session.member_id],
    measure,
    labelOf: (key) => nameOf.get(key) ?? key,
  });

const BY_MEMBER = byMember(one);

const BY_REPOSITORY = capSeries({
  buckets: MONTHS,
  seriesKeysOf: (session) => [session.repository_id],
  measure: one,
  labelOf: (key) => repositoryName.get(key) ?? key,
});

/** What a per-bucket ranking would have named for one month — the forbidden answer (R-V5). */
const perBucketTopLabels = (bucket: PeriodBucket<AgentSession>): readonly string[] => {
  const totals = new Map<string, number>();
  for (const session of bucket.rows) {
    totals.set(session.member_id, (totals.get(session.member_id) ?? 0) + 1);
  }
  return [...totals]
    .map(([key, total]) => ({ label: nameOf.get(key) ?? key, total }))
    .sort((left, right) => right.total - left.total || left.label.localeCompare(right.label))
    .slice(0, NAMED_SERIES_CAP)
    .map((held) => held.label);
};

const valuesIn = (set: SeriesSet, monthKey: string): readonly number[] =>
  set.series.map(
    (series) => series.points.find((point) => point.bucket === monthKey)?.value ?? Number.NaN,
  );

describe("the committed fixture is not empty of what the cap needs (P6, R-D3)", () => {
  it("carries 20 Members, 5 Repositories, 5 WorkTypes and 6 month buckets", () => {
    expect(members).toHaveLength(20);
    expect(repositories).toHaveLength(5);
    expect(workTypes).toHaveLength(5);
    expect(MONTHS.map((bucket) => bucket.key)).toEqual(MONTH_KEYS);
  });

  it("uses no dimension key that collides with the reserved `other` identity", () => {
    // `OTHER_SERIES_KEY` is reserved: a dimension value keyed `other` would be indistinguishable
    // from the bucket. No committed key is, so the collision is a guarded impossibility rather
    // than a silent correction — the same treatment `aggregate.ts` gives an unattributable row.
    const everyKey = [
      ...members.map((member) => member.id),
      ...teams.map((team) => team.id),
      ...repositories.map((repository) => repository.id),
      ...workTypes.map((workType) => workType.key),
      ...models.flatMap((model) => [model.id, model.family, model.tier]),
    ];

    expect(everyKey).not.toContain(OTHER_SERIES_KEY);
  });

  it("ranks differently per bucket than across the whole range — the discriminating property", () => {
    // Without this the file would pass against a per-bucket implementation and prove nothing.
    const april = MONTHS[0];

    expect(perBucketTopLabels(april)).toEqual([
      "Equilibrio Nightly Runner",
      "Irene Vázquez Soto",
      "Rubén Marín Cano",
      "Diego Navarro Prieto",
    ]);
    expect(perBucketTopLabels(april)).not.toEqual(
      BY_MEMBER.series.slice(0, NAMED_SERIES_CAP).map((series) => series.label),
    );
  });
});

describe("T-U11 / A13 — the cap engages on 20 Members and not on 5 Repositories", () => {
  it("renders 20 Members as the four largest plus Other", () => {
    expect(BY_MEMBER.series).toHaveLength(SERIES_LIMIT);
    expect(BY_MEMBER.series.map((series) => series.label)).toEqual([
      "Héctor Camps Vidal",
      "Equilibrio Nightly Runner",
      "Silvia Roldán Nieto",
      "Equilibrio Deploy Bot",
      "Other",
    ]);
    expect(BY_MEMBER.series.map((series) => series.inert)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("lists the 16 Members the bucket holds, ranked, starting with the fifth largest", () => {
    expect(BY_MEMBER.other?.holds).toHaveLength(members.length - NAMED_SERIES_CAP);
    expect(BY_MEMBER.other?.holds[0]).toBe("Irene Vázquez Soto");
    expect(BY_MEMBER.other?.holds).not.toContain("Héctor Camps Vidal");
  });

  it("renders 5 Repositories as five series and no Other bucket", () => {
    expect(BY_REPOSITORY.series.map((series) => series.label)).toEqual([
      "web-console",
      "mobile-app",
      "api-gateway",
      "ml-scoring",
      "terraform-infra",
    ]);
    expect(BY_REPOSITORY.other).toBeNull();
    expect(BY_REPOSITORY.series.some((series) => series.inert)).toBe(false);
    expect(BY_REPOSITORY.series.map((series) => series.key)).not.toContain(OTHER_SERIES_KEY);
  });

  it("renders all five WorkTypes, so the breakdown tile has no Other bucket (R-N8)", () => {
    const byWorkType = capSeries({
      buckets: MONTHS,
      seriesKeysOf: (session) => [session.work_type],
      measure: one,
    });

    expect(byWorkType.series).toHaveLength(5);
    expect(byWorkType.other).toBeNull();
  });
});

describe("T-U11 / A14 — one whole-range ranking, identical in every bucket (R-V5)", () => {
  it("gives every series a point in every month, in month order", () => {
    for (const series of BY_MEMBER.series) {
      expect(series.points.map((point) => point.bucket)).toEqual(MONTH_KEYS);
    }
  });

  it("keeps April's own leaders out of the legend, and the whole range's leaders in it", () => {
    // Irene Vázquez and Rubén Marín lead April and are still inside "Other" there; Héctor Camps
    // and Silvia Roldán are outside April's top four and are still named series in it.
    const april = valuesIn(BY_MEMBER, "2026-04");
    const labels = BY_MEMBER.series.map((series) => series.label);

    expect(labels).not.toContain("Irene Vázquez Soto");
    expect(labels).not.toContain("Rubén Marín Cano");
    expect(april).toEqual([0, 4, 0, 0, 27]);
    // Héctor Camps and Silvia Roldán ran nothing at all in April and keep their series anyway,
    // which is the identity a per-bucket ranking would have taken away.
    expect(labels[0]).toBe("Héctor Camps Vidal");
    expect(april[0]).toBe(0);
  });

  it("loses nothing to the cap: the five series sum to the month's whole session count", () => {
    // Member is a true partition of the sessions, so "Other" is exactly the remainder. A cap
    // that dropped the tail instead of bucketing it would fail every column here.
    const monthly = MONTH_KEYS.map((key) =>
      valuesIn(BY_MEMBER, key).reduce((running, value) => running + value, 0),
    );

    expect(monthly).toEqual([31, 100, 111, 189, 247, 64]);
    expect(monthly.reduce((running, value) => running + value, 0)).toBe(sessions.length);
  });

  it("ranks by the chart's own measure: cost names a different four than session count", () => {
    const byCost = byMember(cost);

    expect(byCost.series.map((series) => series.label)).toEqual([
      "Héctor Camps Vidal",
      "Pablo Herrera Gil",
      "Equilibrio Nightly Runner",
      "Diego Navarro Prieto",
      "Other",
    ]);
    expect(byCost.series.map((series) => series.label)).not.toEqual(
      BY_MEMBER.series.map((series) => series.label),
    );
  });

  it("carries stable domain identities across a roll-up switch (R-T8)", () => {
    const membership = membershipFromTeams(teams);
    const byTeam = capSeries({
      buckets: MONTHS,
      // R-V3 — a Member on two Teams contributes their full figure to each, so the Team series
      // deliberately sum past the Organization's total.
      seriesKeysOf: (session) => membership.get(session.member_id) ?? [],
      measure: one,
    });

    expect(byTeam.series).toHaveLength(teams.length);
    expect(byTeam.other).toBeNull();
    expect(new Set(byTeam.series.map((series) => series.key))).toEqual(
      new Set(teams.map((team) => team.id)),
    );
    expect(
      byTeam.series
        .flatMap((series) => series.points)
        .reduce((running, point) => running + point.value, 0),
    ).toBeGreaterThan(sessions.length);
  });
});

describe("R-V7 — the palette is the ceiling on committed rows", () => {
  it("colours every series from the five theme variables, in order, and never asks for a sixth", () => {
    for (const set of [BY_MEMBER, BY_REPOSITORY, byMember(cost)]) {
      expect(set.series.length).toBeLessThanOrEqual(CHART_COLOR_VARS.length);
      expect(set.series.map((series) => series.colorVar)).toEqual(
        CHART_COLOR_VARS.slice(0, set.series.length),
      );
    }
  });
});

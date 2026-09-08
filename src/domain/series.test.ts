// T-U11 — series capping and ordering (`testing-spec.md` § 3.4, `spec.md` R-V4…R-V7, A13, A14,
// `technical-spec.md` R-T8, R-T30), ticket 27.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so every row
// here is authored inline. The claims are re-asserted against the *committed* fixture in
// `src/data/series.fixture.test.ts`, because P6 says a test that would pass against an empty
// fixture is not a test.
//
// **The centrepiece is `WHOLE_RANGE_VS_PER_BUCKET`**, the dataset T-U11 requires: one where
// ranking per bucket would produce a *different* series set than ranking across the whole
// selected range. It is authored so the disagreement is total rather than marginal — the two
// largest series of the whole range would be swept into "Other" in the second bucket, and two
// series that belong in "Other" would be promoted to named, coloured series with a legend entry.
// That is the failure R-V5 exists to prevent and the exact input that triggers the `key={index}`
// legend reconciliation bug (R-T8, ticket 14). The whole-range answer is asserted.
//
// Figures are authored so every expectation is a whole number and none restates the
// implementation's own arithmetic.

import { describe, expect, it } from "vitest";
import {
  CHART_COLOR_VARS,
  NAMED_SERIES_CAP,
  OTHER_SERIES_KEY,
  SERIES_LIMIT,
  capSeries,
  type SeriesBucket,
  type SeriesInput,
} from "./series";

type Row = { readonly series: string; readonly value: number };

/** `["2026-W20", { a: 100 }]` → a bucket holding one row per named series. */
const chartOf = (
  table: readonly (readonly [string, Readonly<Record<string, number>>])[],
): readonly SeriesBucket<Row>[] =>
  table.map(([key, values]) => ({
    key,
    rows: Object.entries(values).map(([series, value]) => ({ series, value })),
  }));

const inputOf = (
  buckets: readonly SeriesBucket<Row>[],
  labelOf?: (key: string) => string,
): SeriesInput<Row> => ({
  buckets,
  seriesKeysOf: (row) => [row.series],
  measure: (row) => row.value,
  ...(labelOf ? { labelOf } : {}),
});

const keysOf = (input: SeriesInput<Row>): readonly string[] =>
  capSeries(input).series.map((series) => series.key);

/** What a per-bucket ranking would have chosen for one bucket — the forbidden answer (R-V5). */
const perBucketTopKeys = (bucket: SeriesBucket<Row>): readonly string[] =>
  [...bucket.rows]
    .sort((left, right) => right.value - left.value || left.series.localeCompare(right.series))
    .slice(0, NAMED_SERIES_CAP)
    .map((row) => row.series);

// --- The dataset T-U11 requires ------------------------------------------------------------
//
// Whole-range totals:   a 100 · b 90 · c 80 · d 70 · e 60 · f 50  →  top four are a, b, c, d.
//
// Six series, so the cap engages — and **no bucket agrees with that answer**:
//
//   | bucket   | its own top four | disagreement                                  |
//   |----------|------------------|-----------------------------------------------|
//   | 2026-W20 | a · b · e · c    | `e` is named, `d` is not                      |
//   | 2026-W21 | c · d · e · f    | both of the whole range's leaders are dropped |
//   | 2026-W22 | e · f · a · b    | the two series "Other" holds lead the bucket  |
//
// Every bucket is a discriminating case, so a per-bucket ranking is caught whichever bucket it
// happened to rank on. The last one is the vivid case: "Other" holds 107 there while all four
// named series hold nothing, and the cap must still not re-rank.

const WHOLE_RANGE_VS_PER_BUCKET = chartOf([
  ["2026-W20", { a: 100, b: 90, c: 0, d: 0, e: 1, f: 0 }],
  ["2026-W21", { a: 0, b: 0, c: 80, d: 70, e: 1, f: 1 }],
  ["2026-W22", { a: 0, b: 0, c: 0, d: 0, e: 58, f: 49 }],
]);

const LABELS: Readonly<Record<string, string>> = {
  a: "Ana",
  b: "Ben",
  c: "Cleo",
  d: "Dara",
  e: "Eze",
  f: "Fern",
};

const DISAGREEING = inputOf(WHOLE_RANGE_VS_PER_BUCKET, (key) => LABELS[key] ?? key);

describe("one ranking, across the whole selected range, identical in every bucket (R-V5, A14)", () => {
  it("would rank a different set in every bucket — the dataset really does discriminate", () => {
    // Guard on the fixture of this test itself: if any bucket's ranking agreed with the whole
    // range's, a per-bucket implementation that happened to rank on *that* bucket would pass
    // every assertion below and prove nothing.
    expect(WHOLE_RANGE_VS_PER_BUCKET.map(perBucketTopKeys)).toEqual([
      ["a", "b", "e", "c"],
      ["c", "d", "e", "f"],
      ["e", "f", "a", "b"],
    ]);
    for (const bucket of WHOLE_RANGE_VS_PER_BUCKET) {
      expect(perBucketTopKeys(bucket)).not.toEqual(["a", "b", "c", "d"]);
    }
  });

  it("ranks by the chart's own measure across the whole range, and keeps that set everywhere", () => {
    expect(keysOf(DISAGREEING)).toEqual(["a", "b", "c", "d", OTHER_SERIES_KEY]);
  });

  it("keeps the whole range's two largest series named in the bucket where they hold nothing", () => {
    // The per-bucket answer would have swept `a` and `b` into "Other" for 2026-W21 and promoted
    // `e` and `f` in their place: the legend would say one thing in one column and another in
    // the next, and React would reconcile the wrong series across the switch.
    const set = capSeries(DISAGREEING);
    const named = new Map(set.series.map((series) => [series.key, series.points]));

    expect(named.get("a")).toEqual([
      { bucket: "2026-W20", value: 100 },
      { bucket: "2026-W21", value: 0 },
      { bucket: "2026-W22", value: 0 },
    ]);
    expect(named.get("b")).toEqual([
      { bucket: "2026-W20", value: 90 },
      { bucket: "2026-W21", value: 0 },
      { bucket: "2026-W22", value: 0 },
    ]);
  });

  it("never promotes a series the whole range put in Other, in any bucket", () => {
    expect(keysOf(DISAGREEING)).not.toContain("e");
    expect(keysOf(DISAGREEING)).not.toContain("f");
  });

  it("sums the swept series into Other bucket by bucket", () => {
    const other = capSeries(DISAGREEING).series.at(-1);

    // 2026-W22 is the vivid column: "Other" holds 58 + 49 while every named series holds
    // nothing, and the cap still does not re-rank it into four named series.
    expect(other?.points).toEqual([
      { bucket: "2026-W20", value: 1 },
      { bucket: "2026-W21", value: 2 },
      { bucket: "2026-W22", value: 107 },
    ]);
  });

  it("gives every series a point in every bucket, in bucket order", () => {
    const set = capSeries(
      inputOf(
        chartOf([
          ["2026-W20", { a: 5, b: 3 }],
          ["2026-W21", { a: 4 }],
          ["2026-W22", { b: 2 }],
        ]),
      ),
    );

    for (const series of set.series) {
      expect(series.points.map((point) => point.bucket)).toEqual([
        "2026-W20",
        "2026-W21",
        "2026-W22",
      ]);
    }
    expect(set.series.map((series) => series.points.map((point) => point.value))).toEqual([
      [5, 4, 0],
      [3, 0, 2],
    ]);
  });

  it("is a pure function of its input: the same input ranks the same way every time", () => {
    // R-V5's "recomputed only when the range, filters or roll-up level change" is a caching
    // statement about the caller, and it is only safe because nothing here carries state.
    expect(capSeries(DISAGREEING)).toEqual(capSeries(DISAGREEING));
  });
});

describe("the cap engages above five series, and not at five (R-V4, A13, § 11 C1)", () => {
  const dimension = (size: number, prefix: string): SeriesInput<Row> =>
    inputOf(
      chartOf([
        [
          "2026-08",
          Object.fromEntries(
            Array.from({ length: size }, (_unused, index) => [
              `${prefix}${String(index + 1).padStart(2, "0")}`,
              (size - index) * 10,
            ]),
          ),
        ],
        [
          "2026-09",
          Object.fromEntries(
            Array.from({ length: size }, (_unused, index) => [
              `${prefix}${String(index + 1).padStart(2, "0")}`,
              size - index,
            ]),
          ),
        ],
      ]),
    );

  it("renders 20 Members as four named series plus Other", () => {
    const set = capSeries(dimension(20, "member-"));

    expect(set.series).toHaveLength(SERIES_LIMIT);
    expect(set.series.map((series) => series.key)).toEqual([
      "member-01",
      "member-02",
      "member-03",
      "member-04",
      OTHER_SERIES_KEY,
    ]);
    expect(set.other?.holds).toHaveLength(20 - NAMED_SERIES_CAP);
  });

  it("renders 5 Repositories as five series and no Other bucket", () => {
    const set = capSeries(dimension(5, "repo-"));

    expect(set.series).toHaveLength(5);
    expect(set.other).toBeNull();
    expect(set.series.map((series) => series.key)).not.toContain(OTHER_SERIES_KEY);
    // An "Other" bucket holding one repository reads as a rendering fault, so at five there is
    // no bucket at all — not an empty one, and not one holding the fifth repository.
    expect(set.series.every((series) => !series.inert)).toBe(true);
  });

  it("holds the boundary from both sides: five renders five, six renders four plus Other", () => {
    expect(capSeries(dimension(5, "d")).series).toHaveLength(5);
    expect(capSeries(dimension(5, "d")).other).toBeNull();

    const six = capSeries(dimension(6, "d"));
    expect(six.series).toHaveLength(5);
    expect(six.series.filter((series) => series.inert)).toHaveLength(1);
    expect(six.other?.holds).toHaveLength(2);
  });

  it("renders every WorkType when a dimension has exactly five values (R-N8)", () => {
    const set = capSeries(
      inputOf(
        chartOf([
          ["2026-08", { implementation: 40, refactor: 30, bugfix: 20, review: 10, deploy: 5 }],
        ]),
      ),
    );

    expect(set.series.map((series) => series.key)).toEqual([
      "implementation",
      "refactor",
      "bugfix",
      "review",
      "deploy",
    ]);
    expect(set.other).toBeNull();
  });

  it("renders a dimension smaller than the palette without inventing series", () => {
    const set = capSeries(inputOf(chartOf([["2026-08", { solo: 7 }]])));

    expect(set.series).toHaveLength(1);
    expect(set.other).toBeNull();
  });

  it("renders nothing at all, rather than an Other bucket, when no row falls in the range", () => {
    const set = capSeries(inputOf(chartOf([["2026-08", {}]])));

    expect(set.series).toEqual([]);
    expect(set.other).toBeNull();
  });

  it("places a row the grouping cannot key in no series at all", () => {
    const set = capSeries({
      buckets: chartOf([["2026-08", { a: 3, unattributable: 99 }]]),
      seriesKeysOf: (row) => (row.series === "unattributable" ? [] : [row.series]),
      measure: (row) => row.value,
    });

    expect(set.series.map((series) => series.key)).toEqual(["a"]);
    expect(set.series[0].points).toEqual([{ bucket: "2026-08", value: 3 }]);
  });
});

describe("ties break by name ascending (R-V5)", () => {
  it("orders equal totals by label, not by key", () => {
    // The keys sort to a, m, z and the labels to Alpha, Beta, Gamma — opposite orders, so this
    // fails if the tiebreak reaches for the identity a viewer never sees.
    const names: Readonly<Record<string, string>> = { z: "Alpha", a: "Beta", m: "Gamma" };
    const tied = inputOf(chartOf([["2026-08", { z: 10, a: 10, m: 10 }]]), (key) => names[key] ?? key);

    expect(capSeries(tied).series.map((series) => series.label)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
    expect(keysOf(tied)).toEqual(["z", "a", "m"]);
  });

  it("falls back to the key when two series share both a total and a label", () => {
    const duplicated = inputOf(chartOf([["2026-08", { k2: 4, k1: 4 }]]), () => "Same name");

    expect(keysOf(duplicated)).toEqual(["k1", "k2"]);
  });

  it("labels a series with its key when the caller supplies no label map", () => {
    expect(capSeries(inputOf(chartOf([["2026-08", { alpha: 1 }]]))).series[0].label).toBe("alpha");
  });
});

describe('"Other" is inert and lists what it holds (R-V6)', () => {
  const set = capSeries(DISAGREEING);

  it("marks the bucket inert and every named series interactive", () => {
    expect(set.series.map((series) => series.inert)).toEqual([false, false, false, false, true]);
  });

  it("lists what it holds, by label, in the same ranked order the chart is in", () => {
    expect(set.other).toEqual({ holds: ["Eze", "Fern"] });
  });

  it("populates the holds list only when the cap engaged", () => {
    expect(capSeries(inputOf(chartOf([["2026-08", { a: 2, b: 1 }]]))).other).toBeNull();
  });

  it("lets a filter reach past the top four without the cap ever lifting", () => {
    // R-V6: "Filtering is how a viewer reaches beyond the top four; the cap itself never lifts."
    // Filtering is a smaller *input*, not a wider cap — there is no parameter to widen.
    const filtered = WHOLE_RANGE_VS_PER_BUCKET.map((bucket) => ({
      key: bucket.key,
      rows: bucket.rows.filter((row) => row.series === "e" || row.series === "f"),
    }));
    const reached = capSeries(inputOf(filtered, (key) => LABELS[key] ?? key));

    expect(reached.series.map((series) => series.label)).toEqual(["Eze", "Fern"]);
    expect(reached.other).toBeNull();
  });
});

describe("the five-colour palette is never extended (R-V7, R-T30)", () => {
  const dimensionOfHundred = (): SeriesInput<Row> =>
    inputOf(
      chartOf([
        [
          "2026-08",
          Object.fromEntries(
            Array.from({ length: 100 }, (_unused, index) => [`s${index}`, 1000 - index]),
          ),
        ],
      ]),
    );

  it("defines exactly five colours, and derives the cap from them", () => {
    expect(CHART_COLOR_VARS).toEqual([
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--chart-4",
      "--chart-5",
    ]);
    expect(SERIES_LIMIT).toBe(CHART_COLOR_VARS.length);
    expect(NAMED_SERIES_CAP).toBe(4);
  });

  it("never emits more series than there are colours, at any input size", () => {
    for (const size of [1, 5, 6, 20, 100]) {
      const set = capSeries(
        inputOf(
          chartOf([
            [
              "2026-08",
              Object.fromEntries(
                Array.from({ length: size }, (_unused, index) => [`s${index}`, size - index]),
              ),
            ],
          ]),
        ),
      );

      expect(set.series.length).toBeLessThanOrEqual(CHART_COLOR_VARS.length);
      expect(set.series).toHaveLength(Math.min(size, SERIES_LIMIT));
    }
  });

  it("assigns each series a distinct colour from the closed palette, in order", () => {
    const set = capSeries(dimensionOfHundred());

    expect(set.series.map((series) => series.colorVar)).toEqual([...CHART_COLOR_VARS]);
    expect(new Set(set.series.map((series) => series.colorVar)).size).toBe(SERIES_LIMIT);
    // Four named series plus "Other" fills --chart-1..5 exactly: the fifth colour is the
    // bucket's, and there is no sixth for anything to ask for.
    expect(set.series.at(-1)?.colorVar).toBe("--chart-5");
    expect(set.series.at(-1)?.key).toBe(OTHER_SERIES_KEY);
  });

  it("leaves no series without a colour", () => {
    const set = capSeries(dimensionOfHundred());

    expect(set.series.every((series) => CHART_COLOR_VARS.includes(series.colorVar))).toBe(true);
  });
});

describe("series identity is a domain fact, stable across a roll-up switch (R-T8, A14)", () => {
  const rows: readonly SeriesBucket<{ readonly member: string; readonly team: string }>[] = [
    {
      key: "2026-08",
      rows: [
        { member: "mem-01", team: "team-platform" },
        { member: "mem-02", team: "team-platform" },
        { member: "mem-03", team: "team-mobile" },
      ],
    },
    {
      key: "2026-09",
      rows: [
        { member: "mem-01", team: "team-platform" },
        { member: "mem-03", team: "team-mobile" },
      ],
    },
  ];
  const one = (): number => 1;

  it("keys series by the dimension's own identity at either roll-up level", () => {
    const byMember = capSeries({ buckets: rows, seriesKeysOf: (row) => [row.member], measure: one });
    const byTeam = capSeries({ buckets: rows, seriesKeysOf: (row) => [row.team], measure: one });

    // Ranked by count: mem-01 and mem-03 hold two sessions each and break the tie by name;
    // mem-02 holds one. The keys are the dimension's, at whichever level the switch is on.
    expect(byMember.series.map((series) => series.key)).toEqual(["mem-01", "mem-03", "mem-02"]);
    expect(byTeam.series.map((series) => series.key)).toEqual(["team-platform", "team-mobile"]);
  });

  it("emits no key that could be an array index", () => {
    // The `key={index}` bug reconciles "Team A" into "Team B" in place across a roll-up switch.
    // A key that is not a number cannot be an index that a refactor mistook for one.
    const keys = capSeries({ buckets: rows, seriesKeysOf: (row) => [row.team], measure: one }).series
      .map((series) => series.key);

    expect(keys.every((key) => Number.isNaN(Number(key)))).toBe(true);
  });

  it("keeps a series' identity fixed while its position moves between roll-ups", () => {
    const byMember = capSeries({ buckets: rows, seriesKeysOf: (row) => [row.member], measure: one });

    // mem-01 leads on count; mem-03 ties mem-01 at 2 and is second by name. Whatever the order,
    // the key travels with the series rather than with the slot.
    expect(byMember.series.map((series) => [series.key, series.points.map((p) => p.value)])).toEqual(
      [
        ["mem-01", [1, 1]],
        ["mem-03", [1, 1]],
        ["mem-02", [1, 0]],
      ],
    );
  });
});

// --- R-M18 — a bucket a series contributed nothing to (ticket 40) ---------------------------
//
// The cap fills every series' every bucket (R-V5, A14), so it has to say what a bucket a series
// contributed *no row* to reads as. For a sum that is `0` — a Repository with no session in a
// week cost nothing, and the line belongs on the floor. For a ratio it is `null`: a week with no
// Completed Job has no Cost per completed Job, and a point drawn at zero claims the work was
// free. `absent` is the parameter that says which, and it is supplied by `viewmodel.ts` from the
// chart's own `MeasureKind` rather than chosen per panel.

describe("R-M18 — `absent` says what a bucket with no row reads as", () => {
  const gappy = chartOf([
    ["b1", { a: 10, b: 4 }],
    ["b2", { a: 20 }],
  ]);

  it("fills an untouched bucket with zero by default, which is the additive reading", () => {
    const { series } = capSeries(inputOf(gappy));
    const b = series.find((held) => held.key === "b");

    expect(b?.points.map((point) => point.value)).toEqual([4, 0]);
  });

  it("fills it with null where the caller says the measure is a ratio", () => {
    const { series } = capSeries({ ...inputOf(gappy), absent: null });
    const b = series.find((held) => held.key === "b");

    expect(b?.points.map((point) => point.value)).toEqual([4, null]);
  });

  it("keeps a real zero reading as zero — an absent bucket and a measured zero differ", () => {
    const measuredZero = chartOf([
      ["b1", { a: 10, b: 0 }],
      ["b2", { a: 20 }],
    ]);
    const { series } = capSeries({ ...inputOf(measuredZero), absent: null });

    expect(series.find((held) => held.key === "b")?.points.map((point) => point.value)).toEqual([
      0,
      null,
    ]);
  });

  it("gives 'Other' a null bucket only where every series it swept is absent from it", () => {
    // Six series, so the cap engages (R-V4). In `b2` one swept series has a reading and the
    // other does not, so "Other" holds that one reading; in `b3` neither does.
    const { series } = capSeries({
      ...inputOf(
        chartOf([
          ["b1", { a: 60, b: 50, c: 40, d: 30, e: 20, f: 10 }],
          ["b2", { a: 6, e: 5 }],
          ["b3", { a: 1 }],
        ]),
      ),
      absent: null,
    });
    const other = series.find((held) => held.key === OTHER_SERIES_KEY);

    expect(other?.points.map((point) => point.value)).toEqual([30, 5, null]);
  });
});

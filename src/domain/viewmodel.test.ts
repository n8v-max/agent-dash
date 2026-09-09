// The ViewModel assembly — R-T6, R-T7, R-T8, R-V1, R-V4, R-V5, R-V6, R-V9.
//
// The two claims worth the file are the two the seam rests on:
//
//   * **R-T7 — the mirror is an independent derivation, not a second printing.** Asserted twice:
//     once as *equality* with the rendered series (which is what T-C1 will assert through the
//     DOM), and once as *independence* — the mirror is correct for a cap it did not run, over
//     groups the series array does not name.
//   * **R-V1 — `stackable` follows the partition, not the panel**, and Team is never stackable.

import { describe, expect, it } from "vitest";
import {
  GROUPINGS,
  STACKABLE_GROUPINGS,
  chartViewModel,
  stackable,
  tableViewModel,
  type Cell,
  type ChartInput,
  type Grouping,
} from "./viewmodel";

const buckets = (...keys: readonly string[]) =>
  keys.map((key) => ({ key, label: key, partial: false }));

const cell = (bucket: string, group: string, value: number): Cell => ({ bucket, group, value });

const chart = (input: Partial<ChartInput> & Pick<ChartInput, "cells">) =>
  chartViewModel({
    title: "Cost",
    rollUpLevel: "Organization",
    grouping: "work_type",
    measure: "additive",
    buckets: buckets("2026-04", "2026-05"),
    ...input,
  });

/** What the chart *claims*, read back off the mirror: bucket label → column label → value. */
const readMirror = (view: ReturnType<typeof chart>): Record<string, Record<string, number>> =>
  Object.fromEntries(
    view.mirror.rows.map((row) => [
      row[0],
      Object.fromEntries(
        view.mirror.columns.slice(1).map((column, at) => [column, Number(row[at + 1])]),
      ),
    ]),
  );

/** The same reading, off the rendered series. Two paths, one table (R-T7). */
const readSeries = (view: ReturnType<typeof chart>): Record<string, Record<string, number>> =>
  Object.fromEntries(
    view.buckets.map((bucket) => [
      bucket.label,
      Object.fromEntries(
        view.series.map((series) => [
          series.label,
          series.points.find((point) => point.bucket === bucket.key)?.value ?? 0,
        ]),
      ),
    ]),
  );

describe("R-T7 — the mirror is built from the aggregation, not from the series array", () => {
  it("states the same figures the series do (T-C1's cross-check, in the domain layer)", () => {
    const view = chart({
      cells: [
        cell("2026-04", "bugfix", 10),
        cell("2026-04", "review", 4),
        cell("2026-05", "bugfix", 20),
      ],
    });

    expect(readMirror(view)).toEqual(readSeries(view));
    expect(readMirror(view)).toEqual({
      "2026-04": { bugfix: 10, review: 4 },
      "2026-05": { bugfix: 20, review: 0 },
    });
  });

  it("names the bucket in the first column and every series after it, in ranked order", () => {
    const view = chart({
      cells: [cell("2026-04", "review", 4), cell("2026-04", "bugfix", 10)],
    });

    // R-V5 — ranked by the chart's own measure across the whole range, not by input order.
    expect(view.mirror.columns).toEqual(["Period", "bugfix", "review"]);
    expect(view.mirror.rows[0][0]).toBe("2026-04");
  });

  it("sums 'Other' out of the grid itself — the groups the capped series never name (R-V4)", () => {
    // Six groups, so the cap engages: four named plus "Other". The mirror's Other column is a
    // sum over the two swept groups taken from the aggregation table, never off a rendered point.
    const cells = ["a", "b", "c", "d", "e", "f"].map((group, at) =>
      cell("2026-04", group, 60 - at * 10),
    );
    const view = chart({ buckets: buckets("2026-04"), cells });

    expect(view.other).toEqual({ holds: ["e", "f"] });
    expect(readMirror(view)["2026-04"]).toEqual({ a: 60, b: 50, c: 40, d: 30, Other: 30 });
    expect(readMirror(view)).toEqual(readSeries(view));
  });

  it("counts a group into every key it belongs to, so a Team mirror overlaps like the chart does", () => {
    // R-V3 — the same Member's figure in two Teams. The mirror's columns sum past the total,
    // exactly as the stacked geometry would falsely claim they do not, which is why Team is
    // never stackable below.
    const view = chart({
      grouping: "team",
      partition: false,
      overlapNote: "1 Member belongs to more than one Team; totals overlap.",
      buckets: buckets("2026-04"),
      cells: [cell("2026-04", "team_platform", 30), cell("2026-04", "team_data", 30)],
    });

    expect(readMirror(view)["2026-04"]).toEqual({ team_data: 30, team_platform: 30 });
    expect(view.overlapNote).toMatch(/totals overlap/);
  });

  it("adds repeated cells for one (bucket × group) rather than letting the last one win", () => {
    const view = chart({
      buckets: buckets("2026-04"),
      cells: [cell("2026-04", "bugfix", 3), cell("2026-04", "bugfix", 4)],
    });

    expect(readMirror(view)["2026-04"]).toEqual({ bugfix: 7 });
    expect(readMirror(view)).toEqual(readSeries(view));
  });

  it("labels columns through `labelOf`, so the mirror reads as the legend does", () => {
    const view = chart({
      buckets: buckets("2026-04"),
      cells: [cell("2026-04", "mem_a", 5)],
      labelOf: (key) => (key === "mem_a" ? "Ada Lovelace" : key),
      bucketColumn: "Month",
    });

    expect(view.mirror.columns).toEqual(["Month", "Ada Lovelace"]);
  });
});

describe("R-T8 — every key is a domain-supplied identity", () => {
  it("carries the group's own key on the series, unchanged by ranking or capping", () => {
    const view = chart({
      buckets: buckets("2026-04"),
      cells: [cell("2026-04", "review", 1), cell("2026-04", "bugfix", 9)],
    });

    expect(view.series.map((series) => series.key)).toEqual(["bugfix", "review"]);
    expect(view.series.map((series) => series.colorVar)).toEqual(["--chart-1", "--chart-2"]);
  });
});

describe("R-V1 — `stackable` follows the partition, not the panel", () => {
  it("stacks WorkType, Model, execution mode, machine spec and the duration spans", () => {
    const stacking: readonly Grouping[] = [
      "work_type",
      "model",
      "execution_mode",
      "machine_spec",
      "presence_span",
      "cost_component",
    ];
    for (const grouping of stacking) {
      expect(stackable({ grouping, measure: "additive" })).toBe(true);
    }
  });

  it("never stacks Team — not on any measure, and not on a view that happens not to overlap", () => {
    expect(stackable({ grouping: "team", measure: "additive" })).toBe(false);
    expect(stackable({ grouping: "team", measure: "additive", partition: true })).toBe(false);
    expect(STACKABLE_GROUPINGS.team).toBe(false);
    expect(chart({ grouping: "team", cells: [] }).stackable).toBe(false);
  });

  it("never stacks Repository or Member either — R-V1 permits, it does not require", () => {
    expect(stackable({ grouping: "repository", measure: "additive" })).toBe(false);
    expect(stackable({ grouping: "member", measure: "additive" })).toBe(false);
    expect(stackable({ grouping: "organization", measure: "additive" })).toBe(false);
    expect(stackable({ grouping: "measure", measure: "additive" })).toBe(false);
  });

  it("never stacks a ratio, however cleanly its grouping partitions the rows", () => {
    // Cost per completed Task by WorkType: WorkType partitions the sessions, and the five
    // ratios still do not add up to an Organization ratio.
    expect(stackable({ grouping: "work_type", measure: "ratio" })).toBe(false);
  });

  it("lets a roll-up veto the geometry: a non-partitioning dimension is never stacked", () => {
    expect(stackable({ grouping: "work_type", measure: "additive", partition: false })).toBe(false);
  });

  it("decides every grouping there is — the lookup is total", () => {
    for (const grouping of GROUPINGS) {
      expect(typeof STACKABLE_GROUPINGS[grouping]).toBe("boolean");
    }
  });
});

describe("R-V9 — an emptied panel says so", () => {
  it("is empty when the aggregation produced no cell at all", () => {
    const view = chart({ cells: [] });

    expect(view.empty).toBe(true);
    expect(view.series).toEqual([]);
    expect(view.mirror.columns).toEqual(["Period"]);
    expect(view.other).toBeNull();
  });

  it("is not empty where the figures are real and happen to be zero", () => {
    expect(chart({ cells: [cell("2026-04", "bugfix", 0)] }).empty).toBe(false);
  });
});

describe("the table ViewModel sorts in the domain layer (R-T6)", () => {
  const columns = [
    { key: "member", label: "Member", numeric: false, sortable: true },
    { key: "tasks", label: "Completed Tasks", numeric: true, sortable: true },
  ];
  const rows = [
    { key: "mem_a", cells: ["Ada", 3] },
    { key: "mem_b", cells: ["Grace", 9] },
    { key: "mem_c", cells: ["Alan", null] },
  ];

  it("sorts descending by the named column, with withheld figures last", () => {
    const table = tableViewModel({
      columns,
      rows,
      sort: { column: "tasks", direction: "desc" },
    });

    expect(table.rows.map((row) => row.key)).toEqual(["mem_b", "mem_a", "mem_c"]);
  });

  it("keeps a withheld figure last ascending too — `null` is not a small number", () => {
    const table = tableViewModel({ columns, rows, sort: { column: "tasks", direction: "asc" } });

    expect(table.rows.map((row) => row.key)).toEqual(["mem_a", "mem_b", "mem_c"]);
  });

  it("sorts text by label, and breaks every tie on the row's own stable key", () => {
    const byName = tableViewModel({ columns, rows, sort: { column: "member", direction: "asc" } });
    expect(byName.rows.map((row) => row.key)).toEqual(["mem_a", "mem_c", "mem_b"]);

    const tied = tableViewModel({
      columns,
      rows: [
        { key: "mem_z", cells: ["Ada", 3] },
        { key: "mem_a", cells: ["Ada", 3] },
      ],
      sort: { column: "tasks", direction: "desc" },
    });
    expect(tied.rows.map((row) => row.key)).toEqual(["mem_a", "mem_z"]);
  });

  it("leaves the rows as built when the sort names no column, rather than throwing", () => {
    const table = tableViewModel({
      columns,
      rows,
      sort: { column: "percentile", direction: "desc" },
      note: "2 Members contribute to the totals without being resolved by name.",
    });

    expect(table.rows.map((row) => row.key)).toEqual(["mem_a", "mem_b", "mem_c"]);
    expect(table.note).toMatch(/without being resolved by name/);
  });

  it("is empty with no rows, and carries no note unless one was computed", () => {
    const table = tableViewModel({ columns, rows: [], sort: { column: "tasks", direction: "desc" } });

    expect(table.empty).toBe(true);
    expect(table.note).toBeNull();
  });

  // --- What the three rows above cannot tell apart (ticket 52) -------------------------------
  //
  // Ticket 52's mutation run reported the whole comparator as changeable without a failure, and
  // it was right: three rows carrying 3, 9 and `null` pass under a comparator that *adds* the
  // two values instead of subtracting them, because every value is positive, and they pass under
  // one that compares the values as text, because "3" and "9" sort the same way the numbers do.
  // The order asserted was reachable by arithmetic that means nothing. These rows are chosen so
  // that it is not: a two-digit figure whose text sorts *below* every one-digit one, and a zero,
  // which a comparator that adds cannot tell from any other value it is placed beside. The
  // withheld rows get their own fixture below, keyed so that sinking them and floating them are
  // two different answers.
  //
  // No spec was edited and no requirement was re-decided; this is added coverage.

  const ranked = [
    { key: "mem_p", cells: ["Ada", 3] },
    { key: "mem_q", cells: ["Grace", 12] },
    { key: "mem_r", cells: ["Alan", 0] },
    { key: "mem_s", cells: ["Edsger", 7] },
  ];

  const rankedBy = (direction: "asc" | "desc") =>
    tableViewModel({ columns, rows: ranked, sort: { column: "tasks", direction } }).rows.map(
      (row) => row.cells[1],
    );

  it("ranks a numeric column by the number, not by the text of it", () => {
    // 12 outranks 7, 3 and 0, which "12" does not: as text it sorts below every one of them.
    expect(rankedBy("desc")).toEqual([12, 7, 3, 0]);
    expect(rankedBy("asc")).toEqual([0, 3, 7, 12]);
  });

  it("reads the direction off the comparison, so the two orderings are each other reversed", () => {
    expect(rankedBy("asc")).toEqual([...rankedBy("desc")].reverse());
  });

  it("keeps a withheld figure last however the column is read, and however the row is keyed", () => {
    // R-A6: `null` is a withheld grant, not a small number. Both withheld rows are keyed ahead
    // of the figures they sit beside, so a comparator that let them fall through to the key
    // tie-break would float them to the top of both readings instead of sinking them.
    const withheld = [
      { key: "mem_b", cells: ["Edsger", null] },
      { key: "mem_c", cells: ["Grace", 12] },
      { key: "mem_a", cells: ["Alan", null] },
      { key: "mem_d", cells: ["Ada", 3] },
    ];
    const keysBy = (direction: "asc" | "desc") =>
      tableViewModel({ columns, rows: withheld, sort: { column: "tasks", direction } }).rows.map(
        (row) => row.key,
      );

    // The two withheld rows hold the last two places in both readings, and they are handed over
    // in the reverse of their key order, so the tie between them is broken on the key — the only
    // ordering left once the figure has stopped deciding anything — and not on arrival order.
    expect(keysBy("desc")).toEqual(["mem_c", "mem_d", "mem_a", "mem_b"]);
    expect(keysBy("asc")).toEqual(["mem_d", "mem_c", "mem_a", "mem_b"]);
  });

  it("leaves the rows as built when the sort names no column, even out of key order", () => {
    // The rows are handed over in the reverse of their key order, so "as built" and "by key"
    // are two different answers here and the assertion can tell which one it got.
    const table = tableViewModel({
      columns,
      rows: [ranked[1], ranked[0]],
      sort: { column: "percentile", direction: "desc" },
    });

    expect(table.rows.map((row) => row.key)).toEqual(["mem_q", "mem_p"]);
    // R-V9 read from the other end: a panel that has rows must not report itself emptied.
    expect(table.empty).toBe(false);
  });
});

// --- R-M18 — a ratio chart breaks at a bucket it has no reading for (ticket 40) --------------
//
// `aggregationCells` emits **no cell** where a metric module returned `null`, so the hole is
// already in the aggregation result by the time it reaches here. What this settles is what the
// two paths out of that result do with it, and they must agree: the series carries `null` so the
// chart breaks its line (`connectNulls={false}`), and the mirror carries `null` so the table
// prints an em dash. `MeasureKind` decides — an *additive* measure's missing cell is a real zero
// (a Repository with no session in a week cost nothing), a *ratio*'s is no reading at all.

describe("R-M18 — a zero denominator reaches the chart as a gap, not as a zero", () => {
  const ratioChart = (cells: readonly Cell[]) =>
    chart({ measure: "ratio", buckets: buckets("2026-W15", "2026-W16"), cells });

  const pointsOf = (view: ReturnType<typeof chart>, key: string) =>
    view.series.find((series) => series.key === key)?.points.map((point) => point.value);

  it("carries null on the series where a ratio bucket held no reading", () => {
    const view = ratioChart([cell("2026-W16", "organization", 14.83)]);

    expect(pointsOf(view, "organization")).toEqual([null, 14.83]);
  });

  it("carries null in the mirror for the same bucket, so the table prints a dash", () => {
    const view = ratioChart([cell("2026-W16", "organization", 14.83)]);

    expect(view.mirror.rows).toEqual([
      ["2026-W15", null],
      ["2026-W16", 14.83],
    ]);
  });

  it("still draws an additive measure's missing bucket at zero — nothing spent is a reading", () => {
    const view = chart({
      measure: "additive",
      buckets: buckets("2026-W15", "2026-W16"),
      cells: [cell("2026-W16", "web-console", 40)],
    });

    expect(pointsOf(view, "web-console")).toEqual([0, 40]);
    expect(view.mirror.rows).toEqual([
      ["2026-W15", 0],
      ["2026-W16", 40],
    ]);
  });

  it("keeps a ratio that really was zero as zero, and never as a gap", () => {
    // An acceptance rate of 0 over five sessions is a measurement; 0 sessions is not.
    const view = ratioChart([
      cell("2026-W15", "deploy", 0),
      cell("2026-W16", "deploy", 0.5),
    ]);

    expect(pointsOf(view, "deploy")).toEqual([0, 0.5]);
    expect(view.mirror.rows).toEqual([
      ["2026-W15", 0],
      ["2026-W16", 0.5],
    ]);
  });

  it("agrees between the two paths where the cap swept the gap into 'Other' (R-T7)", () => {
    const view = chart({
      measure: "ratio",
      buckets: buckets("b1", "b2", "b3"),
      cells: [
        ...["a", "b", "c", "d", "e", "f"].map((group, at) => cell("b1", group, 60 - at * 10)),
        cell("b2", "a", 6),
        cell("b2", "e", 5),
        cell("b3", "a", 1),
      ],
    });
    const other = view.series.find((series) => series.inert);
    const mirrorOther = view.mirror.rows.map((row) => row[row.length - 1]);

    expect(other?.points.map((point) => point.value)).toEqual([30, 5, null]);
    expect(mirrorOther).toEqual([30, 5, null]);
  });
});

// --- R-V12 — the chart's form, and what it does to the table (ticket 44) ---------------------
//
// A ranked chart has **no time axis**: its groups are the bars, ordered by R-V5's whole-range
// ranking, over one bucket covering the selected period. The mirror is therefore transposed —
// one row per group, headed by the grouping — because a table of one row and twenty columns is
// the accessible statement of a chart nobody can read either.

describe("R-V12 — `form` is a domain fact, and a ranked chart's table is one row per group", () => {
  const ranked = (input: Partial<ChartInput> = {}) =>
    chart({
      form: "ranked",
      rollUpLevel: "Member",
      grouping: "member",
      buckets: buckets("range"),
      cells: [
        cell("range", "ada", 10),
        cell("range", "grace", 30),
        cell("range", "alan", 20),
      ],
      ...input,
    });

  it("defaults to a series chart, read over its own period buckets", () => {
    const view = chart({ cells: [cell("2026-04", "bugfix", 10)] });

    expect(view.form).toBe("series");
    expect(view.mirror.columns[0]).toBe("Period");
  });

  it("heads the first column with the grouping and gives each group its own row", () => {
    const view = ranked();

    expect(view.form).toBe("ranked");
    expect(view.mirror.columns).toEqual(["Member", "range"]);
    // R-V5's whole-range ranking, descending — which on one bucket is the order of the bars.
    expect(view.mirror.rows).toEqual([
      ["grace", 30],
      ["alan", 20],
      ["ada", 10],
    ]);
  });

  it("states the same figures the series do, on the transposed path too (R-T7)", () => {
    const view = ranked();
    const fromSeries = view.series.map((series) => [
      series.label,
      series.points.find((point) => point.bucket === "range")?.value ?? null,
    ]);

    expect(view.mirror.rows).toEqual(fromSeries);
  });

  it("gives the capped tail its own row, summed out of the grid and not off a point (R-V4)", () => {
    const view = ranked({
      cells: ["a", "b", "c", "d", "e", "f"].map((group, at) =>
        cell("range", group, 60 - at * 10),
      ),
    });

    expect(view.other).toEqual({ holds: ["e", "f"] });
    expect(view.mirror.rows.at(-1)).toEqual(["Other", 30]);
  });

  it("carries an absent reading into the transposed table as `null` (R-M18)", () => {
    const view = ranked({
      measure: "ratio",
      buckets: buckets("range", "later"),
      cells: [cell("range", "ada", 10)],
    });

    expect(view.mirror.rows).toEqual([["ada", 10, null]]);
  });
});

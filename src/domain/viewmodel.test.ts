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
});

// The façade, over the **committed** fixture (ticket 28; R-T6, R-T7, R-T8, R-T16, R-T17, R-V1).
//
// This is the seam's own test. It runs each of the six page queries for both shipped accounts
// and asserts the four properties the seam rests on:
//
//   * **every panel in `spec.md` § 3 has a complete ViewModel** — the wave-9 precondition, so it
//     is checked rather than judged;
//   * **the mirror equals the rendered series, everywhere** (R-T7, T-C1). The mirror is summed
//     out of the aggregation table and the series out of the cap, so this compares two
//     traversals of one table rather than one array printed twice — and it does it over real
//     data, where the cap actually engages;
//   * **`stackable` follows the partition** (R-V1), and **Team is never stackable**;
//   * **the permission filter ran before aggregation** (R-T17, R-A6): the restricted account's
//     figures are smaller, and no cost figure for another Member reaches its payload.
//
// P6 — a test that would pass against an empty fixture is not a test, so the assertions below
// are pinned to figures the committed data actually carries.

import { describe, expect, it } from "vitest";
import { roleFor, membershipFromTeams, type Viewer } from "@/domain/access";
import type { ChartViewModel } from "@/domain/viewmodel";
import { loadDataset } from "./load";
import { controlsWith, defaultControls, type ControlSet, type PageKey } from "./params";
import {
  historyPage,
  peoplePage,
  projectionPage,
  spendPage,
  summaryPage,
  workPage,
} from "./queries";

const data = loadDataset();
const membership = membershipFromTeams(data.teams);

/** P5 — the instant every query is run against. The committed window ends 2026-09-08. */
const NOW = "2026-09-08T12:00:00+02:00";
const RANGE = { start: data.organization.window_start, end: data.organization.window_end };

const viewerFor = (memberRole: string): Viewer => {
  const member = data.members.find((candidate) => candidate.role === memberRole);
  if (!member) throw new Error(`no Member carries the role ${memberRole}`);
  return {
    memberId: member.id,
    teamIds: membership.get(member.id) ?? [],
    role: roleFor(member.role),
  };
};

/** R-A3's two accounts, resolved from the fixture exactly as `resolveViewer` resolves them. */
const OPEN = viewerFor("member");
const RESTRICTED = viewerFor("contractor");

const paramsFor = (page: PageKey, overrides: Partial<ControlSet> = {}): ControlSet =>
  controlsWith(defaultControls({ page, orgSlug: "demo", range: RANGE, now: NOW }), overrides);

/** Every chart on a page ViewModel, found structurally — so a new panel is covered by default. */
const chartsIn = (value: unknown, found: ChartViewModel[] = []): readonly ChartViewModel[] => {
  if (Array.isArray(value)) {
    for (const item of value) chartsIn(item, found);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  const candidate = value as Partial<ChartViewModel>;
  if (candidate.mirror && candidate.series && typeof candidate.stackable === "boolean") {
    found.push(value as ChartViewModel);
  }
  for (const held of Object.values(value)) chartsIn(held, found);
  return found;
};

/** The chart's claim, read off the mirror: bucket label → column label → value. */
const fromMirror = (chart: ChartViewModel): Record<string, Record<string, unknown>> =>
  Object.fromEntries(
    chart.mirror.rows.map((row) => [
      row[0],
      Object.fromEntries(chart.mirror.columns.slice(1).map((column, at) => [column, row[at + 1]])),
    ]),
  );

/** The same claim, read off the rendered series. Two paths, one aggregation table (R-T7). */
const fromSeries = (chart: ChartViewModel): Record<string, Record<string, unknown>> =>
  Object.fromEntries(
    chart.buckets.map((bucket) => [
      bucket.label,
      Object.fromEntries(
        chart.series.map((series) => [
          series.label,
          series.points.find((point) => point.bucket === bucket.key)?.value ?? 0,
        ]),
      ),
    ]),
  );

const allPages = (viewer: Viewer) => ({
  summary: summaryPage(viewer, paramsFor("summary")),
  spend: spendPage(viewer, paramsFor("spend")),
  work: workPage(viewer, paramsFor("work")),
  people: peoplePage(viewer, paramsFor("people")),
  history: historyPage(viewer, paramsFor("history")),
  projection: projectionPage(viewer, paramsFor("projection")),
});

const OPEN_PAGES = allPages(OPEN);

describe("the panel checklist — every panel in `spec.md` § 3 has a ViewModel", () => {
  it("`/demo` (R-N4) — four tiles, the fourth carrying the WorkType chart", () => {
    expect(OPEN_PAGES.summary.tiles.map((held) => held.key)).toEqual([
      "total-spend",
      "completed-tasks",
      "cost-per-completed-task",
      "completed-tasks-by-work-type",
    ]);
    // R-N7 — each tile carries a change figure, subject to R-M12's floor.
    for (const held of OPEN_PAGES.summary.tiles) expect(held.change).toHaveProperty("shown");
    expect(OPEN_PAGES.summary.tiles[3].chart?.series).toHaveLength(5);
  });

  it("`/demo/spend` (R-N9) — seven panels in order, plus the rate card (R-N11)", () => {
    const page = OPEN_PAGES.spend;
    expect(Object.keys(page)).toEqual([
      "orgSlug",
      "costPerCompletedTask",
      "totalSpend",
      "costPerSession",
      "costPerCompletedTaskByWorkType",
      "costByRepository",
      "adoption",
    ]);
    expect(page.adoption.tokensOverTime.series.length).toBeGreaterThan(0);
    expect(page.adoption.modelMix.chart.series.length).toBeGreaterThan(0);
    expect(page.adoption.rateCard.table.rows).toHaveLength(data.models.length);
  });

  it("`/demo/work` (R-N12) — six panels, acceptance as five small multiples (R-N13)", () => {
    const page = OPEN_PAGES.work;
    expect(page.acceptance.map((panel) => panel.workType)).toEqual([
      "implementation",
      "refactor",
      "bugfix",
      "review",
      "deploy",
    ]);
    expect(page.acceptanceAxis).toEqual({ min: 0, max: 1 });
    expect(page.velocity.chart.series.length).toBeGreaterThan(0);
    expect(page.taskRates.chart.series.map((series) => series.key)).toEqual([
      "rework",
      "decomposition",
    ]);
    expect(page.incompleteAges.ages.buckets.map((bucket) => bucket.key)).toEqual([
      "0-7",
      "8-30",
      "31-90",
      "91+",
    ]);
    expect(page.duration.summary.median).not.toBeNull();
    expect(page.presenceSpans.composition.executionMode).toBe("interactive");
  });

  it("`/demo/people` — the seven-column table (R-N15) and the matrix (R-A10)", () => {
    const page = OPEN_PAGES.people;
    expect(page.surface).toBe("table");
    if (page.surface !== "table") throw new Error("expected the table surface");
    expect(page.table.columns.map((column) => column.key)).toEqual([
      "member",
      "team",
      "kind",
      "completedTasks",
      "sessions",
      "tokens",
      "cost",
    ]);
    // R-N15 — every numeric column sortable, and the default sort is Completed Tasks descending.
    expect(page.table.columns.filter((column) => column.numeric).every((column) => column.sortable))
      .toBe(true);
    expect(page.table.sort).toEqual({ column: "completedTasks", direction: "desc" });
    expect(page.matrix.rows).toHaveLength(6);
  });

  it("`/demo/people?member=` — the profile (R-N16) and the comparator (R-N17, R-N18)", () => {
    const page = peoplePage(OPEN, paramsFor("people", { member: OPEN.memberId }));
    expect(page.surface).toBe("profile");
    if (page.surface !== "profile") throw new Error("expected the profile surface");

    expect(page.profile.tiles).toHaveLength(4);
    expect(page.profile.workTypeMix.series.length).toBeGreaterThan(0);
    expect(page.profile.comparator.group?.label).toMatch(/, \d+ members$/);
    // R-N17 — three bars. R-N18 — acceptance rate is not one of them.
    expect(page.profile.comparator.bars.map((bar) => bar.key)).toEqual([
      "completed-tasks-per-period",
      "cost-per-completed-task",
      "tokens-processed",
    ]);
  });

  it("`/demo/history` — the flat table (R-N19) and the expandable row (R-N20.1)", () => {
    const page = OPEN_PAGES.history;
    expect(page.surface).toBe("table");
    if (page.surface !== "table") throw new Error("expected the table surface");

    expect(page.table.columns.map((column) => column.key)).toEqual([
      "startedAt",
      "member",
      "workType",
      "repository",
      "taskKey",
      "executionMode",
      "accepted",
      "duration",
      "tokens",
      "cost",
    ]);
    expect(page.pageSize).toBe(50);

    const row = page.table.rows[0];
    // R-N20.1 — the four disjoint classes and the Model mix, and they agree (T-C9.1's claim).
    const byClass = row.detail.tokensByClass;
    expect(byClass).not.toBeNull();
    const summed = Object.values(byClass ?? {}).reduce((left, right) => left + right, 0);
    expect(summed).toBe(row.detail.tokensProcessed);
    expect(row.detail.modelMix?.length).toBeGreaterThan(0);
  });

  it("`/demo/history?session=` — one session expanded, addressably", () => {
    const table = OPEN_PAGES.history;
    if (table.surface !== "table") throw new Error("expected the table surface");
    const one = historyPage(OPEN, paramsFor("history", { session: table.table.rows[0].key }));

    expect(one.surface).toBe("session");
    if (one.surface !== "session") throw new Error("expected the session surface");
    expect(one.row.key).toBe(table.table.rows[0].key);
  });

  it("`/demo/projection` — actual to date plus the extrapolation (R-N23)", () => {
    const page = OPEN_PAGES.projection;

    expect(page.tiles.map((held) => held.key)).toEqual(["spend-to-date", "projected-cost"]);
    expect(page.elapsed.totalDays).toBe(30);
    expect(page.elapsed.fraction).toBeGreaterThan(0);
    expect(page.elapsed.fraction).toBeLessThan(1);
    expect(page.incomplete).toBe(true);
    expect(page.method).toMatch(/proportion to the period elapsed/);
    expect(page.projected?.total ?? 0).toBeGreaterThan(page.actual.total);
    expect(page.chart.series.length).toBeGreaterThan(0);
  });

  it("`/demo/projection` produces no confidence band (R-N24)", () => {
    const page = OPEN_PAGES.projection;
    const keys = [...Object.keys(page), ...Object.keys(page.elapsed)];

    expect(keys.filter((key) => /band|confidence|interval|margin/i.test(key))).toEqual([]);
  });
});

describe("R-T7 — the mirror states what the chart claims, on every panel of every page", () => {
  const pages = Object.entries(OPEN_PAGES);

  it.each(pages)("%s: every chart's mirror equals its rendered series (T-C1)", (_name, page) => {
    const charts = chartsIn(page);
    // `/demo/people` and `/demo/history` open on a table, so a page may legitimately carry none.
    for (const chart of charts) {
      expect(fromMirror(chart)).toEqual(fromSeries(chart));
      // The header row names the buckets' column and then every series, in ranked order.
      expect(chart.mirror.columns.slice(1)).toEqual(chart.series.map((series) => series.label));
      expect(chart.mirror.rows).toHaveLength(chart.buckets.length);
    }
  });

  it("cross-checks a capped chart, where the two paths could most easily disagree (R-V4)", () => {
    // 20 Members, so the cap engages: four named plus "Other", whose column the mirror sums out
    // of the aggregation table over exactly the groups the cap did not name.
    const page = spendPage(OPEN, paramsFor("spend", { subject: "member" }));
    const chart = page.costByRepository;
    const members = page.adoption.tokensOverTime;

    expect(members.series).toHaveLength(5);
    expect(members.other?.holds.length).toBeGreaterThan(0);
    expect(fromMirror(members)).toEqual(fromSeries(members));
    expect(fromMirror(chart)).toEqual(fromSeries(chart));
  });

  it("gives every series a domain-supplied key, and never an array index (R-T8)", () => {
    for (const chart of chartsIn(OPEN_PAGES)) {
      for (const series of chart.series) {
        expect(series.key).not.toMatch(/^\d+$/);
        expect(series.key.length).toBeGreaterThan(0);
      }
      expect(new Set(chart.series.map((series) => series.key)).size).toBe(chart.series.length);
    }
  });
});

describe("R-V1 — `stackable` follows the partition, not the panel", () => {
  it("never stacks a Team-grouped panel, on any page", () => {
    for (const page of [
      spendPage(OPEN, paramsFor("spend", { subject: "team" })),
      workPage(OPEN, paramsFor("work", { subject: "team" })),
    ]) {
      const stacked = chartsIn(page).filter((chart) => chart.stackable);
      expect(stacked.every((chart) => chart.rollUpLevel !== "Team")).toBe(true);
      // R-V3 — and a Team grouping states the overlap in words.
      const teamCharts = chartsIn(page).filter((chart) => chart.rollUpLevel === "Team");
      expect(teamCharts.length).toBeGreaterThan(0);
      for (const chart of teamCharts) {
        expect(chart.stackable).toBe(false);
        expect(chart.overlapNote).toMatch(/Member/);
      }
    }
  });

  it("stacks the partitions R-V1 names: WorkType, Model, the spans, the cost split", () => {
    expect(OPEN_PAGES.summary.tiles[3].chart?.stackable).toBe(true);
    expect(OPEN_PAGES.spend.totalSpend.chart.stackable).toBe(true);
    expect(OPEN_PAGES.spend.adoption.modelMix.chart.stackable).toBe(true);
    expect(OPEN_PAGES.work.presenceSpans.chart.stackable).toBe(true);
  });

  it("never stacks a ratio, even where the grouping partitions the rows", () => {
    expect(OPEN_PAGES.spend.costPerCompletedTaskByWorkType.stackable).toBe(false);
    expect(OPEN_PAGES.spend.costPerSession.chart.stackable).toBe(false);
    expect(OPEN_PAGES.work.duration.chart.stackable).toBe(false);
  });

  it("never stacks Repository (R-V1), nor a Member or Organization grouping", () => {
    expect(OPEN_PAGES.spend.costByRepository.stackable).toBe(false);
    expect(spendPage(OPEN, paramsFor("spend", { subject: "member" })).adoption.tokensOverTime.stackable)
      .toBe(false);
  });
});

describe("R-T17 / R-A6 — the permission filter ran before aggregation", () => {
  const restricted = allPages(RESTRICTED);

  it("gives the restricted account a smaller Total spend than the open one", () => {
    expect(restricted.spend.totalSpend.sessionCost).toBeGreaterThan(0);
    expect(restricted.spend.totalSpend.sessionCost).toBeLessThan(
      OPEN_PAGES.spend.totalSpend.sessionCost,
    );
  });

  it("gives it its Team's tokens — more than its own, and fewer than the Organization's", () => {
    const own = restricted.spend.adoption.volume.processed;
    expect(own).toBeGreaterThan(0);
    expect(own).toBeLessThan(OPEN_PAGES.spend.adoption.volume.processed);
  });

  it("resolves nobody but itself by name on `/demo/people`, and says how many it did not", () => {
    const page = restricted.people;
    if (page.surface !== "table") throw new Error("expected the table surface");

    expect(page.table.rows.map((row) => row.key)).toEqual([RESTRICTED.memberId]);
    expect(page.table.note).toMatch(/counted and not named/);
    // R-A10 — and it still reaches the matrix, showing its own grants (R-A3.1).
    expect(page.matrix.roleKey).toBe("restricted");
  });

  it("withholds another Member's profile rather than rendering one (R-A6)", () => {
    const other = data.members.find((member) => member.id !== RESTRICTED.memberId);
    const page = peoplePage(RESTRICTED, paramsFor("people", { member: other?.id ?? "mem_none" }));

    expect(page.surface).toBe("withheld");
  });

  it("puts no other Member's cost figure anywhere in the payload (R-T18's claim, upstream)", () => {
    const page = restricted.history;
    if (page.surface !== "table") throw new Error("expected the table surface");

    for (const row of page.table.rows) {
      expect(row.cells[1]).toBe(
        data.members.find((member) => member.id === RESTRICTED.memberId)?.full_name,
      );
    }
    expect(page.table.note).toMatch(/reach them aggregated/);
  });
});

describe("the controls the pages declare (R-C1) reach the queries", () => {
  it("narrows every panel by the Repository filter", () => {
    const [repository] = data.repositories;
    const page = spendPage(OPEN, paramsFor("spend", { repository: repository.id }));

    expect(page.costByRepository.series.map((series) => series.label)).toEqual([repository.name]);
    expect(page.totalSpend.sessionCost).toBeLessThan(OPEN_PAGES.spend.totalSpend.sessionCost);
  });

  it("applies the `accepted` filter to Cost per session and to nothing else (R-M1)", () => {
    const page = spendPage(OPEN, paramsFor("spend", { accepted: "accepted" }));

    expect(page.costPerSession.outcome).toBe("accepted");
    expect(page.costPerSession.range.sessions).toBeLessThan(
      OPEN_PAGES.spend.costPerSession.range.sessions,
    );
    // The unfiltered panels are untouched: `accepted` is R-M1's filter on this metric alone.
    expect(page.totalSpend.total).toBe(OPEN_PAGES.spend.totalSpend.total);
  });

  it("divides by active human Members when per-capita is on (R-M14)", () => {
    const page = workPage(OPEN, paramsFor("work", { perCapita: true }));

    expect(page.velocity.perCapita).toBe(true);
    expect(page.velocity.denominator).toBe(18);
    expect(page.velocity.chart.stackable).toBe(false);
  });

  it("renders every Model roll-up level, and the three carry one total (R-M7, T-U17)", () => {
    const page = spendPage(OPEN, paramsFor("spend", { modelLevel: "tier" }));

    expect(page.adoption.modelMix.level).toBe("tier");
    expect(page.adoption.modelMix.levels.tier.total).toBe(page.adoption.modelMix.levels.exact.total);
    expect(page.adoption.modelMix.levels.family.total).toBe(page.adoption.modelMix.total);
  });

  it("empties a panel rather than inventing one, when a filter matches nothing (R-V9)", () => {
    const page = spendPage(
      OPEN,
      paramsFor("spend", { repository: "repo_that_does_not_exist" }),
    );

    expect(page.costByRepository.empty).toBe(true);
    expect(page.costByRepository.series).toEqual([]);
    expect(page.costPerCompletedTask.empty).toBe(true);
  });

  it("coerces day grain over a range longer than two months (R-M11, T-C5)", () => {
    const params = paramsFor("spend", { grain: "day" });

    expect(params.grain).toBe("month");
  });
});

describe("the degenerate arms — a range with nothing in it, and an id that names nothing", () => {
  /** A range entirely outside the committed window: every panel is legitimately empty (R-V9). */
  const EMPTY = { start: "2027-01-01", end: "2027-01-31" };
  const emptyParams = (page: PageKey): ControlSet =>
    controlsWith(defaultControls({ page, orgSlug: "demo", range: EMPTY, now: NOW }), {});

  it("returns four tiles with no figures rather than no tiles (R-N4, R-V9)", () => {
    const page = summaryPage(OPEN, emptyParams("summary"));

    expect(page.tiles).toHaveLength(4);
    expect(page.tiles[1].value).toBe(0);
    expect(page.tiles[3].chart?.empty).toBe(true);
  });

  it("returns every spend panel empty, and the rate card regardless (R-N11)", () => {
    const page = spendPage(OPEN, emptyParams("spend"));

    expect(page.costPerCompletedTask.empty).toBe(true);
    expect(page.totalSpend.total).toBeGreaterThan(0); // seats are charged whatever ran (R-M5)
    expect(page.adoption.rateCard.table.rows).toHaveLength(data.models.length);
  });

  it("returns every work panel empty, including the five acceptance multiples (R-N13)", () => {
    const page = workPage(OPEN, emptyParams("work"));

    expect(page.acceptance).toHaveLength(5);
    expect(page.acceptance.every((panel) => panel.rate.rate === null)).toBe(true);
    expect(page.duration.summary).toEqual({ count: 0, median: null, p95: null });
    expect(page.incompleteAges.ages.total).toBe(0);
    expect(page.presenceSpans.composition.sessions).toBe(0);
  });

  it("returns an empty People table and an empty History table, with the matrix intact", () => {
    const people = peoplePage(OPEN, emptyParams("people"));
    if (people.surface !== "table") throw new Error("expected the table surface");
    expect(people.table.rows).toHaveLength(data.members.length);
    expect(people.matrix.datapoints).toEqual(["jobs", "tokens", "cost", "access"]);

    const history = historyPage(OPEN, emptyParams("history"));
    if (history.surface !== "table") throw new Error("expected the table surface");
    expect(history.table.empty).toBe(true);
  });

  it("projects a month that has not started as unavailable rather than as zero", () => {
    const page = projectionPage(OPEN, emptyParams("projection"));

    expect(page.elapsed.fraction).toBe(0);
    expect(page.projected).toBeNull();
    expect(page.unavailable).toMatch(/no elapsed share/);
  });

  it("withholds a session id that names no row this viewer may read", () => {
    const page = historyPage(OPEN, paramsFor("history", { session: "ses_not_a_session" }));

    expect(page.surface).toBe("withheld");
  });

  it("withholds a Member id that names nobody", () => {
    const page = peoplePage(OPEN, paramsFor("people", { member: "mem_nobody" }));

    expect(page.surface).toBe("withheld");
  });
});

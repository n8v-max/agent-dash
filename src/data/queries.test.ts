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
/** The two months ticket 39's rule is read at either end of: one unfinished, one whole. */
const SEPTEMBER = { start: "2026-09-01", end: data.organization.window_end };
const AUGUST = { start: "2026-08-01", end: "2026-08-31" };

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
  it("`/demo` (R-N4) — four tiles, the breakdown beside the count it breaks down", () => {
    // Ticket 39's order: the breakdown sits third, next to Completed Jobs, because it is that
    // tile's own measure cut by template. The ratio is last, where the sentence ends.
    expect(OPEN_PAGES.summary.tiles.map((held) => held.key)).toEqual([
      "total-spend",
      "completed-tasks",
      "completed-tasks-by-work-type",
      "cost-per-completed-task",
    ]);
    // R-N7 — each *figure* tile carries a change, subject to R-M12's floor and C13's rules.
    // The breakdown carries neither figure nor change (C11).
    const kinds = OPEN_PAGES.summary.tiles.map((held) => held.kind);
    expect(kinds).toEqual(["figure", "figure", "breakdown", "figure"]);
    const changes = OPEN_PAGES.summary.tiles.flatMap((held) =>
      held.kind === "figure" ? [held.change] : [],
    );
    expect(changes).toHaveLength(3);
    for (const change of changes) expect(change).toHaveProperty("shown");

    const mix = OPEN_PAGES.summary.tiles[2];
    if (mix.kind !== "breakdown") throw new Error("expected the breakdown tile");
    expect(mix.chart.series).toHaveLength(5);
    // C11 — one bucket, the reported month, so R-V5's whole-range ranking is the sort.
    expect(mix.chart.buckets).toHaveLength(1);
  });

  it("suppresses every change on a part-month, and names the reason once per tile (C13)", () => {
    // The committed window ends mid-September, so the month the page opens on is unfinished.
    // Ticket 39: the delta is withheld rather than flagged, because eight days against a whole
    // August is the calendar rather than the spend. Read here through the real query, over the
    // real fixture, because the reason has to reach the tile a component renders.
    const september = summaryPage(OPEN, paramsFor("summary", { range: SEPTEMBER }));
    const reasons = september.tiles.flatMap((held) =>
      held.kind === "figure" && !held.change.shown ? [held.change.reason] : [],
    );

    expect(september.period).toMatchObject({ key: "2026-09", partial: true });
    expect(reasons).toEqual([
      "current-period-incomplete",
      "current-period-incomplete",
      "current-period-incomplete",
    ]);

    // …and the contrast case, which is what stops the rule above passing vacuously: August is
    // whole, July is whole, so all three figures are shown.
    const august = summaryPage(OPEN, paramsFor("summary", { range: AUGUST }));
    expect(august.period).toMatchObject({ key: "2026-08", partial: false });
    expect(august.tiles.every((held) => held.kind === "breakdown" || held.change.shown)).toBe(true);
  });

  it("prints no figure on the mix tile, because the tile beside it already prints it (C11)", () => {
    const [, tasks, mix] = OPEN_PAGES.summary.tiles;
    if (tasks.kind !== "figure" || mix.kind !== "breakdown") throw new Error("wrong tile kinds");

    // The defect this replaced: the mix tile spread the Completed Tasks reading, so `/demo`
    // printed one number and one delta twice, side by side, on the ten-second read.
    expect(tasks.value).not.toBeNull();
    expect(mix).not.toHaveProperty("value");
    expect(mix).not.toHaveProperty("change");
  });

  it("the mix tile's slices exceed the Completed Jobs tile, which is why it cannot stack (C11)", () => {
    const [, tasks, mix] = OPEN_PAGES.summary.tiles;
    if (tasks.kind !== "figure" || mix.kind !== "breakdown") throw new Error("wrong tile kinds");

    // WorkType partitions sessions; this tile counts Tasks, whose sessions may span WorkTypes.
    // Asserted as arithmetic rather than as a flag: were these ever to agree, the measure would
    // have been silently re-keyed, and that should fail here rather than pass quietly.
    const slices = mix.chart.series.reduce(
      (running, series) => running + series.points.reduce((sum, point) => sum + point.value, 0),
      0,
    );
    expect(slices).toBeGreaterThan(tasks.value ?? 0);
    expect(mix.chart.stackable).toBe(false);
  });

  it("`/demo/spend` (R-N9) — seven panels in order, plus the rate card (R-N11)", () => {
    const page = OPEN_PAGES.spend;
    expect(Object.keys(page)).toEqual([
      "orgSlug",
      // C14 — not a panel: which panels below are divided, and by how many.
      "perCapita",
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
    // C9 — the visibility sentence, on every arm, in place of the withdrawn matrix.
    expect(page.visibility).toMatch(/every other Member of this Organization by name/);
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

describe("R-T30 — a series key survives being turned into a CSS custom property", () => {
  const pages = Object.entries(OPEN_PAGES);

  // shadcn's `ChartStyle` mints `--color-${key}` from the series key, so a key carrying a space
  // produces `--color-Claude Sonnet`: not a valid property name, so the browser drops the whole
  // declaration and `fill="var(--color-Claude Sonnet)"` resolves to nothing. The mark renders
  // unpainted while the legend swatch — which reads `--chart-N` directly — stays coloured, so it
  // is the silent wrong-colour failure R-T30 and T-C3 exist to close, not a visible error.
  //
  // Model `family` was authored for a reader ("Claude Sonnet") and was being used as the key.
  // Every other grouping is already keyed on an identifier. This asserts the property for all of
  // them at once, so the next grouping keyed on a label fails here rather than in a browser.
  const CSS_IDENT = /^[\w-]+$/;

  it.each(pages)("%s: every series key is a valid custom-property ident", (_name, page) => {
    for (const chart of chartsIn(page)) {
      for (const series of chart.series) {
        expect(series.key, `series key ${JSON.stringify(series.key)}`).toMatch(CSS_IDENT);
      }
    }
  });

  it.each(["exact", "family", "tier"] as const)(
    "holds at Model roll-up level %s, which is where it failed",
    (level) => {
      const page = spendPage(OPEN, paramsFor("spend", { modelLevel: level }));
      const keys = page.adoption.modelMix.chart.series.map((series) => series.key);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(key, `${level}: ${key}`).toMatch(CSS_IDENT);
    },
  );

  it("keeps the authored label at `family`, where the key had to change", () => {
    const page = spendPage(OPEN, paramsFor("spend", { modelLevel: "family" }));
    const series = page.adoption.modelMix.chart.series;
    // The key is now an identifier; the reader's text is untouched.
    expect(series.map((entry) => entry.label)).toContain("Claude Sonnet");
    expect(series.map((entry) => entry.key)).toContain("Claude-Sonnet");
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

  it("stacks the partitions R-V1 names: Model, the spans, the cost split", () => {
    // The `/demo` WorkType tile is deliberately absent from this list — C11. `stackable` is keyed
    // on (grouping × measure), and WorkType does not partition a Task-grained measure.
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

  it("resolves nobody but itself by name on `/demo/people` — one row, no aggregate (C10)", () => {
    const page = restricted.people;
    if (page.surface !== "table") throw new Error("expected the table surface");

    expect(page.table.rows.map((row) => row.key)).toEqual([RESTRICTED.memberId]);
    // C10 — the aggregate is real and lives on `/demo/work` and `/demo/spend`, not here.
    expect(page.table.note).toBeNull();
    // C9 — the sentence explains the one row, and carries no figure to be subtracted from.
    expect(page.visibility).toMatch(/without being named/);
    expect(page.visibility).not.toMatch(/\d/);
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

    const [, tasks, mix] = page.tiles;
    if (tasks.kind !== "figure" || mix.kind !== "breakdown") throw new Error("wrong tile kinds");
    expect(tasks.value).toBe(0);
    expect(mix.chart.empty).toBe(true);
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

  it("returns an empty People table and an empty History table, with the sentence intact", () => {
    const people = peoplePage(OPEN, emptyParams("people"));
    if (people.surface !== "table") throw new Error("expected the table surface");
    expect(people.table.rows).toHaveLength(data.members.length);
    expect(people.visibility).not.toBe("");

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

describe("C14 — per-capita on `/demo/spend` divides the money panels, and only those", () => {
  const raw = OPEN_PAGES.spend;
  const divided = spendPage(OPEN, paramsFor("spend", { perCapita: true }));

  it("was declared by R-C1 and read by nothing — the defect this replaced", () => {
    // The guard, not the feature: T-C6 passed throughout, because the control *rendered*. What
    // it never asserted is that anything downstream read it.
    expect(divided.perCapita.on).toBe(true);
    expect(raw.perCapita.on).toBe(false);
    expect(divided).not.toEqual(raw);
  });

  it("divides Total spend by R-M14's denominator, and says so in the title", () => {
    const denominator = divided.perCapita.denominator;

    expect(denominator).toBeGreaterThan(1);
    expect(divided.totalSpend.total).toBeCloseTo(raw.totalSpend.total / denominator, 8);
    expect(divided.totalSpend.sessionCost).toBeCloseTo(raw.totalSpend.sessionCost / denominator, 8);
    expect(divided.totalSpend.seatCost).toBeCloseTo(raw.totalSpend.seatCost / denominator, 8);
    expect(divided.totalSpend.chart.title).toMatch(/per Member/);
  });

  it("keeps Total spend stackable, because the parts still sum to the whole", () => {
    // The one place this differs from `/demo/work`'s velocity panel, which becomes a ratio under
    // the same toggle. Session cost per Member and seat cost per Member add to total spend per
    // Member exactly, so R-V1 has no reason to veto the geometry.
    expect(divided.totalSpend.chart.stackable).toBe(true);
    const [first] = divided.totalSpend.chart.mirror.rows;
    const parts = (first ?? []).slice(1).filter((cell) => typeof cell === "number");
    expect(parts).toHaveLength(2);
  });

  it("divides Cost by Repository and leaves the three ratios untouched", () => {
    expect(divided.costByRepository.title).toMatch(/per Member/);
    // Already normalised, so dividing by a headcount would state nothing. Asserted as identity
    // rather than as an absent title, because a title is copy and this is arithmetic.
    expect(divided.costPerCompletedTask).toEqual(raw.costPerCompletedTask);
    expect(divided.costPerSession).toEqual(raw.costPerSession);
    expect(divided.costPerCompletedTaskByWorkType).toEqual(raw.costPerCompletedTaskByWorkType);
  });

  it("uses the population's active humans, never the rows' authors (R-M14)", () => {
    // 18 of the 20 committed Members hold a seat; the other two are service accounts. A
    // denominator counted off the rows would drift with the filters and would delete R-D10's
    // dormant seat-holder, which is the sharpest finding in the product.
    const seatHolders = data.members.filter((member) => member.kind !== "service_account").length;
    expect(divided.perCapita.denominator).toBe(seatHolders);
    expect(divided.perCapita.denominator).toBeLessThan(data.members.length);
  });
});


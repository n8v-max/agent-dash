// **T-C4** — every control serialises to the query string and round-trips, and a bare route
// renders page defaults (A19, R-C3, R-C4).
// **T-C5** — invalid combinations are coerced or rejected, never rendered (A3, R-M11).
//
// The round-trip table is driven off `CONTROLS`, and a test below asserts that every member of it
// has a case here. A control added without a URL representation therefore fails this file rather
// than shipping as a value the share link silently drops — which is the failure R-C3 names.

import { describe, expect, it } from "vitest";
import { observationWindow } from "@/data/clock";
import {
  CONTROLS,
  controlsWith,
  DECLARED_CONTROLS,
  defaultControls,
  type ControlKey,
  type ControlSet,
  type PageKey,
} from "@/data/params";
import {
  canonicalQuery,
  controlHref,
  declaredControls,
  parseControls,
  pathFor,
  periodOptions,
  type ControlOverrides,
  type ControlQuery,
} from "./schema";

const WINDOW = observationWindow();
/** P5 — pinned, and never serialised: `now` is an argument, not a control. */
const NOW = "2026-09-08T12:00:00+02:00";
const ORG = "demo";

const parse = (page: PageKey, query: ControlQuery): ControlSet =>
  parseControls({ page, orgSlug: ORG, window: WINDOW, now: NOW, query });

const defaults = (page: PageKey): ControlSet =>
  defaultControls({ page, orgSlug: ORG, range: WINDOW, now: NOW });

const href = (page: PageKey, overrides: ControlOverrides): string =>
  controlHref({ controls: defaults(page), window: WINDOW, overrides });

/** The query a href carries, as a plain object — the thing a viewer would paste into a chat. */
const queryOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(url.split("?")[1] ?? ""));

const monthOption = (key: string) => {
  const option = periodOptions(WINDOW).find((candidate) => candidate.value === key);
  if (!option) throw new Error(`the committed window does not contain ${key}`);
  return option;
};

const AUGUST = monthOption("2026-08");

type Case = {
  readonly control: ControlKey;
  readonly page: PageKey;
  readonly overrides: ControlOverrides;
  readonly expected: Readonly<Record<string, string>>;
};

/** One case per control in `CONTROLS` — R-C3's "everything serialises", enumerated. */
const CASES: readonly Case[] = [
  {
    control: "period",
    page: "spend",
    overrides: { range: AUGUST.range },
    expected: { period: "2026-08" },
  },
  {
    control: "dateRange",
    page: "history",
    overrides: { range: { start: "2026-05-04", end: "2026-05-31" } },
    expected: { from: "2026-05-04", to: "2026-05-31" },
  },
  { control: "grain", page: "spend", overrides: { grain: "month" }, expected: { grain: "month" } },
  {
    control: "subject",
    page: "work",
    overrides: { subject: "team" },
    expected: { subject: "team" },
  },
  {
    control: "repository",
    page: "spend",
    overrides: { repository: "repo_web_console" },
    expected: { repository: "repo_web_console" },
  },
  {
    control: "workType",
    page: "work",
    overrides: { workType: "bugfix" },
    expected: { work_type: "bugfix" },
  },
  {
    control: "accepted",
    page: "spend",
    overrides: { accepted: "not-accepted" },
    expected: { accepted: "not-accepted" },
  },
  {
    control: "perCapita",
    page: "work",
    overrides: { perCapita: true },
    expected: { per_capita: "1" },
  },
  {
    control: "modelLevel",
    page: "spend",
    overrides: { modelLevel: "tier" },
    expected: { model_level: "tier" },
  },
  {
    control: "executionMode",
    page: "work",
    overrides: { executionMode: "headless" },
    expected: { execution_mode: "headless" },
  },
  {
    control: "team",
    page: "people",
    overrides: { team: "team_platform" },
    expected: { team: "team_platform" },
  },
  {
    control: "memberKind",
    page: "people",
    overrides: { memberKind: "service_account" },
    expected: { member_kind: "service_account" },
  },
  {
    control: "sort",
    page: "people",
    overrides: { sort: { column: "cost", direction: "asc" } },
    expected: { sort: "cost" },
  },
  {
    control: "member",
    page: "history",
    overrides: { member: "mem_0001" },
    expected: { member: "mem_0001" },
  },
];

describe("T-C4 — controls serialise to the query string and round-trip (A19, R-C3)", () => {
  it("has a case for every control the product has", () => {
    expect([...new Set(CASES.map((entry) => entry.control))].sort()).toEqual([...CONTROLS].sort());
  });

  it.each(CASES)("$control serialises under its own key", ({ page, overrides, expected }) => {
    expect(queryOf(href(page, overrides))).toEqual(expected);
  });

  it.each(CASES)("$control survives the round trip", ({ page, overrides, expected }) => {
    const written = parse(page, expected);
    // Parsing the href's own query gives the same set back — the trip closes on itself.
    expect(parse(page, queryOf(href(page, overrides)))).toEqual(written);
    expect(canonicalQuery(written, WINDOW)).toEqual(new URLSearchParams(expected));
    // ...and that set is the page defaults *for this range* with exactly this control changed.
    // The range is part of the baseline because a page default may depend on it: `/demo/history`
    // opens at day grain, which R-M11 allows over a month and refuses over the whole window.
    expect(written).toEqual(
      controlsWith(defaultControls({ page, orgSlug: ORG, range: written.range, now: NOW }), overrides),
    );
  });

  it.each(CASES)("$control is dropped by a page that does not declare it (R-C1)", (entry) => {
    const foreign = (["summary", "spend", "work", "people", "history", "projection"] as const).find(
      (page) => !declaredControls(page).includes(entry.control),
    );
    expect(foreign).toBeDefined();
    if (!foreign) return;
    expect(canonicalQuery(parse(foreign, entry.expected), WINDOW).toString()).toBe("");
  });

  it("renders page defaults for a bare route, on every page (R-C4)", () => {
    for (const page of Object.keys(DECLARED_CONTROLS) as PageKey[]) {
      expect(parse(page, {})).toEqual(defaults(page));
    }
  });

  it("omits every parameter equal to the page default, so a bare route is canonical", () => {
    for (const page of Object.keys(DECLARED_CONTROLS) as PageKey[]) {
      expect(canonicalQuery(defaults(page), WINDOW).toString()).toBe("");
      expect(controlHref({ controls: defaults(page), window: WINDOW })).toBe(pathFor(page, ORG));
    }
  });

  it("keeps the page's surface parameter across a control change (R-N16, R-N20.1)", () => {
    const profile = parse("people", { member: "mem_0001", team: "team_platform" });
    expect(profile.member).toBe("mem_0001");
    expect(queryOf(controlHref({ controls: profile, window: WINDOW, overrides: { team: null } })))
      .toEqual({ member: "mem_0001" });

    const session = parse("history", { session: "ses_0001" });
    expect(canonicalQuery(session, WINDOW).get("session")).toBe("ses_0001");
  });

  it("never serialises `now` — it is an argument, not a control (P5)", () => {
    const query = canonicalQuery(parse("spend", { period: "2026-08" }), WINDOW).toString();
    expect(query).not.toContain("2026-09-08");
    expect(query).toBe("period=2026-08");
  });

  it("carries no query into a nav path (R-C5, R-T27)", () => {
    expect(pathFor("work", ORG)).toBe("/demo/work");
    for (const page of Object.keys(DECLARED_CONTROLS) as PageKey[]) {
      expect(pathFor(page, ORG)).not.toContain("?");
    }
  });
});

describe("T-C5 — invalid combinations are coerced or rejected, never rendered (A3)", () => {
  it("coerces day grain over a range longer than two months (R-M11)", () => {
    const controls = parse("spend", { grain: "day" });
    expect(controls.range).toEqual(WINDOW);
    expect(controls.grain).not.toBe("day");
    expect(controls.grain).toBe("month");
    expect(canonicalQuery(controls, WINDOW).get("grain")).not.toBe("day");
  });

  it("offers day grain once the period is short enough to carry it", () => {
    const controls = parse("spend", { period: "2026-08", grain: "day" });
    expect(controls.grain).toBe("day");
    expect(queryOf(controlHref({ controls, window: WINDOW }))).toEqual({
      period: "2026-08",
      grain: "day",
    });
  });

  it("re-coerces the grain when a link widens the period (R-T26)", () => {
    const day = parse("spend", { period: "2026-08", grain: "day" });
    const widened = parse("spend", queryOf(controlHref({ controls: day, window: WINDOW, overrides: { range: WINDOW } })));
    expect(widened.grain).not.toBe("day");
  });

  it("drops a value outside a closed vocabulary and keeps the default", () => {
    const controls = parse("spend", {
      grain: "fortnight",
      subject: "cohort",
      accepted: "maybe",
      model_level: "vendor",
      work_type: "meeting",
    });
    expect(controls).toEqual(defaults("spend"));
  });

  it("rejects a sort naming a column the People table does not carry (A24)", () => {
    expect(parse("people", { sort: "-vibes" }).sort).toEqual(defaults("people").sort);
    expect(parse("people", {}).sort).toEqual({ column: "completedTasks", direction: "desc" });
  });

  it("falls back to the observation window for a range it cannot honour", () => {
    expect(parse("history", { from: "not-a-date", to: "2026-05-01" }).range).toEqual(WINDOW);
    expect(parse("history", { from: "2019-01-01", to: "2019-12-31" }).range).toEqual(WINDOW);
    expect(parse("history", { from: "2026-06-01", to: "2026-05-01" }).range).toEqual(WINDOW);
  });

  it("clips a range that reaches outside the window into it", () => {
    expect(parse("history", { from: "2019-01-01", to: "2026-05-31" }).range).toEqual({
      start: WINDOW.start,
      end: "2026-05-31",
    });
  });

  it("reads the first value of a repeated parameter", () => {
    expect(parse("spend", { subject: ["team", "member"] }).subject).toBe("team");
  });

  it("ignores an unknown period token and an empty identifier", () => {
    expect(parse("spend", { period: "2029-01" }).range).toEqual(WINDOW);
    expect(parse("spend", { repository: "" }).repository).toBeNull();
  });
});

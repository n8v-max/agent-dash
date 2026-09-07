// The toolbar's options, over the **committed** fixture.
//
// Two of them are access decisions and one is R-M11, which is why they are a query rather than a
// component's own lookup: the Member filter must offer only Members the viewer can name (R-A6),
// and the grain control must offer only grains the range can carry (A3).
//
// P6 — the assertions below are pinned to figures the committed fixture actually carries, so a
// fixture that lost its roster would fail here rather than pass vacuously.

import { describe, expect, it } from "vitest";
import { membershipFromTeams, roleFor, type Viewer } from "@/domain/access";
import { loadDataset } from "../load";
import { controlsWith, defaultControls, type ControlSet, type PageKey } from "../params";
import { controlOptions, PEOPLE_SORT_COLUMNS } from "./controls";
import { PEOPLE_COLUMNS } from "./people";

const data = loadDataset();
const membership = membershipFromTeams(data.teams);
const NOW = "2026-09-08T12:00:00+02:00";
const WINDOW = { start: data.organization.window_start, end: data.organization.window_end };

const viewerFor = (memberRole: string): Viewer => {
  const member = data.members.find((candidate) => candidate.role === memberRole);
  if (!member) throw new Error(`no Member carries the role ${memberRole}`);
  return {
    memberId: member.id,
    teamIds: membership.get(member.id) ?? [],
    role: roleFor(member.role),
  };
};

const OPEN = viewerFor("member");
const RESTRICTED = viewerFor("contractor");

const paramsFor = (page: PageKey, overrides: Partial<ControlSet> = {}): ControlSet =>
  controlsWith(defaultControls({ page, orgSlug: "demo", range: WINDOW, now: NOW }), overrides);

describe("controlOptions — the Member filter is a grant, not a roster (R-A6, R-A9)", () => {
  it("offers the whole roster to the open account", () => {
    const offered = controlOptions(OPEN, paramsFor("history")).members;

    expect(offered.length).toBeGreaterThan(10);
    expect(offered.map((option) => option.value)).toContain(OPEN.memberId);
  });

  it("offers the restricted account strictly fewer Members, and never more", () => {
    const open = controlOptions(OPEN, paramsFor("history")).members;
    const restricted = controlOptions(RESTRICTED, paramsFor("history")).members;

    expect(restricted.length).toBeLessThan(open.length);
    // R-A3.1 — `self` is granted to every Role always, so the list is never empty.
    expect(restricted.map((option) => option.value)).toContain(RESTRICTED.memberId);
    const openIds = new Set(open.map((option) => option.value));
    for (const option of restricted) expect(openIds.has(option.value)).toBe(true);
  });

  it("names nobody the viewer cannot resolve", () => {
    const offered = controlOptions(RESTRICTED, paramsFor("history")).members;
    const offeredIds = new Set(offered.map((option) => option.value));
    const labels = new Set(offered.map((option) => option.label));
    const unresolvable = data.members
      .filter((member) => !offeredIds.has(member.id))
      .map((member) => member.full_name);

    expect(unresolvable.length).toBeGreaterThan(0);
    expect(unresolvable.filter((name) => labels.has(name))).toEqual([]);
  });
});

describe("controlOptions — grains follow R-M11 (A3)", () => {
  it("withholds day grain over the whole observation window", () => {
    expect(controlOptions(OPEN, paramsFor("spend")).grains).toEqual(["week", "month"]);
  });

  it("offers day grain over a single month", () => {
    const august = paramsFor("spend", { range: { start: "2026-08-01", end: "2026-08-31" } });

    expect(controlOptions(OPEN, august).grains).toEqual(["day", "week", "month"]);
  });
});

describe("controlOptions — the lists do not narrow with the selection", () => {
  it("offers every Repository even while one is selected, so the filter is undoable", () => {
    const all = controlOptions(OPEN, paramsFor("spend")).repositories;
    const filtered = controlOptions(
      OPEN,
      paramsFor("spend", { repository: data.repositories[0]?.id ?? null }),
    ).repositories;

    expect(all).toEqual(filtered);
    expect(all).toHaveLength(data.repositories.length);
  });

  it("offers every template and every Team", () => {
    const options = controlOptions(OPEN, paramsFor("work"));

    expect(options.workTypes).toHaveLength(data.workTypes.length);
    expect(options.teams).toHaveLength(data.teams.length);
  });
});

describe("controlOptions — sort offers the People table's own sortable columns (R-N15)", () => {
  it("offers exactly the columns the table marks sortable", () => {
    expect(PEOPLE_SORT_COLUMNS.map((option) => option.value)).toEqual(
      PEOPLE_COLUMNS.filter((column) => column.sortable).map((column) => column.key),
    );
    expect(controlOptions(OPEN, paramsFor("people")).sortColumns).toEqual(PEOPLE_SORT_COLUMNS);
  });

  it("offers no non-numeric column, so no surface can default to sorting by name", () => {
    const numeric = new Set<string>(
      PEOPLE_COLUMNS.filter((column) => column.numeric).map((column) => column.key),
    );

    for (const option of PEOPLE_SORT_COLUMNS) expect(numeric.has(option.value)).toBe(true);
  });
});

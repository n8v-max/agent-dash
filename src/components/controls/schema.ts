// **R-T26 — the one module that owns the control schema.** Parse in, serialise out, and the
// page's declared set as data. Everything that knows how a control is spelled in a URL is here;
// nothing else in the program spells one.
//
// Four properties, each load-bearing:
//
//   * **The query string is the single source of truth** (R-T25). Every function here is pure and
//     takes the URL's own values as arguments. Nothing in `components/controls/` is a Client
//     Component, so there is no `useState` that *could* shadow a control value — the guarantee is
//     structural, and `page-toolbar.test.tsx` asserts the absence rather than trusting it.
//   * **Invalid combinations are coerced, not rendered** (T-C5, A3). `controlsWith` re-runs
//     `coerceGrain` on every parse and on every link this module builds, so `?grain=day` over a
//     range longer than two months resolves to a grain the range can carry (R-M11) before any
//     query sees it. A value outside a closed vocabulary is not a value: it is dropped and the
//     page default stands.
//   * **A parameter equal to the page default is omitted** (R-C4), so a bare route is the
//     canonical short form and "reset" is a link to the path with no query at all.
//   * **A page reads only the controls it declares** (R-C1). `?sort=cost:asc` on `/demo/spend` is
//     not a control that page has, so it is not read and not written — which is what stops a
//     stale parameter surviving a hand-edited URL.
//
// **Navigation between pages carries no query** (R-C5, R-T27): `pathFor` returns a path and has
// no parameter it could put one in. The absence is the mechanism, and T-E5 is the test.

import {
  controlsWith,
  defaultControls,
  DECLARED_CONTROLS,
  CONTROL_VOCABULARIES,
  type ControlKey,
  type ControlSet,
  type PageKey,
} from "@/data/params";
import { PEOPLE_SORT_COLUMNS } from "@/data/queries";
import type { PeriodRange } from "@/domain/periods";

/** `searchParams`, as Next resolves it. A repeated parameter arrives as an array. */
export type ControlQuery = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * How each control is spelled in the query string. Snake_case, matching the domain's own field
 * names (`work_type`, `execution_mode`), so a URL reads as the vocabulary it filters on.
 *
 * `dateRange` is the one control spanning two parameters; `from`/`to` are its halves and it
 * carries the `from` key here so the record stays total.
 */
export const QUERY_KEYS: Readonly<Record<ControlKey, string>> = {
  period: "period",
  dateRange: "from",
  grain: "grain",
  subject: "subject",
  repository: "repository",
  workType: "work_type",
  accepted: "accepted",
  perCapita: "per_capita",
  modelLevel: "model_level",
  executionMode: "execution_mode",
  team: "team",
  memberKind: "member_kind",
  sort: "sort",
  member: "member",
};

const RANGE_END_KEY = "to";
/** `?session=` — R-N20.1's expanded row. Addressable, but never a control (R-C1). */
const SESSION_KEY = "session";
/** The period token standing for the Organization's whole observation window. */
export const WHOLE_WINDOW = "window";

/** R-N1's six routes, as path segments. The only place a page key becomes a URL. */
const PAGE_PATHS: Readonly<Record<PageKey, string>> = {
  summary: "",
  spend: "/spend",
  work: "/work",
  people: "/people",
  history: "/history",
  projection: "/projection",
};

/**
 * A page's path, and **nothing else** — no query, no way to pass one. R-C5/R-T27 hold because
 * every nav `href` in the shell comes from here.
 */
export const pathFor = (page: PageKey, orgSlug: string): string => `/${orgSlug}${PAGE_PATHS[page]}`;

/** R-C1 as data: the controls this page's panels use, and therefore the only ones it may show. */
export const declaredControls = (page: PageKey): readonly ControlKey[] => DECLARED_CONTROLS[page];

// --- Periods ------------------------------------------------------------------------------
//
// The period token → range mapping lives with the parser rather than in the data layer because
// resolving `?period=2026-08` into a `PeriodRange` *is* parsing: without it there is no range to
// build a `ControlSet` around, and a `ControlSet` is what every query takes. The arithmetic is
// civil-date string work — no metric, no bucketing, nothing R-T6 reserves to `src/domain`.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** One offered period: the token the URL carries, what a viewer reads, and the range it means. */
export type PeriodOption = {
  readonly value: string;
  readonly label: string;
  readonly range: PeriodRange;
};

const lastDayOf = (year: number, month: number): string =>
  new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

const monthLabel = (year: number, month: number): string =>
  `${MONTH_NAMES[month - 1] ?? month} ${year}`;

/** ISO civil dates compare correctly as text, which is all the clipping below needs. */
const later = (left: string, right: string): string => (left > right ? left : right);
const earlier = (left: string, right: string): string => (left < right ? left : right);

/**
 * **Which pages offer the whole observation window as a period** (ticket 39).
 *
 * `/demo` does not. It is month-locked (R-N6) and every tile on it is a month against the month
 * before, so "All data" was a period the page's own argument could not be read over: five months
 * of spend beside a change figure measured on the last of them. The other pages keep it — they
 * plot series over the range, where the whole window is the most useful default there is.
 *
 * A total record rather than a set, so a new page has to answer the question rather than inherit
 * an answer from whichever side of a `!==` it happens to fall on.
 */
const OFFERS_WHOLE_WINDOW: Readonly<Record<PageKey, boolean>> = {
  summary: false,
  spend: true,
  work: true,
  people: true,
  history: true,
  projection: true,
};

/** Every calendar month the window touches, newest first. One construction, shared by all pages. */
const monthsIn = (bounds: PeriodRange): readonly PeriodOption[] => {
  const [firstYear, firstMonth] = [Number(bounds.start.slice(0, 4)), Number(bounds.start.slice(5, 7))];
  const lastIndex = Number(bounds.end.slice(0, 4)) * 12 + Number(bounds.end.slice(5, 7)) - 1;
  const months: PeriodOption[] = [];
  for (let index = firstYear * 12 + firstMonth - 1; index <= lastIndex; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push({
      value: `${year}-${String(month).padStart(2, "0")}`,
      label: monthLabel(year, month),
      range: {
        start: later(`${year}-${String(month).padStart(2, "0")}-01`, bounds.start),
        end: earlier(lastDayOf(year, month), bounds.end),
      },
    });
  }
  return months.reverse();
};

/**
 * **The periods a page offers**: the whole window where the page takes one, then every calendar
 * month it touches, newest first.
 *
 * Calendar months rather than trailing day counts because a month is the unit the Organization is
 * billed in (R-M5) and the unit `/demo` reports (R-N6) — and because a single month is short
 * enough for R-M11 to offer day grain, so the period and grain controls visibly interact instead
 * of one silently constraining the other.
 *
 * The months are the *fixture's* months, because the bounds are the Organization's observation
 * window: a period holding no data is not offered, on any page.
 */
export function periodOptions(page: PageKey, bounds: PeriodRange): readonly PeriodOption[] {
  const months = monthsIn(bounds);
  return OFFERS_WHOLE_WINDOW[page]
    ? [{ value: WHOLE_WINDOW, label: "All data", range: bounds }, ...months]
    : months;
}

/**
 * **The period a bare route opens on** (R-C4) — the whole window, or, where a page does not offer
 * it, the newest month the window touches. That is the *current* month: the clock is clamped to
 * the window's last day (`clock.ts`), so the newest month is the month in progress.
 *
 * It is the first offered option in both cases, which is what keeps the default a value the
 * control can also be returned to rather than a hidden seventh state.
 */
export const defaultPeriodRange = (page: PageKey, bounds: PeriodRange): PeriodRange =>
  periodOptions(page, bounds)[0]?.range ?? bounds;

const rangeEquals = (left: PeriodRange, right: PeriodRange): boolean =>
  left.start === right.start && left.end === right.end;

/** The token a range serialises back to, or `undefined` where only `from`/`to` can express it. */
const tokenFor = (page: PageKey, range: PeriodRange, bounds: PeriodRange): string | undefined =>
  periodOptions(page, bounds).find((option) => rangeEquals(option.range, range))?.value;

export { rangeEquals };

// --- Parsing ------------------------------------------------------------------------------

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A repeated parameter is a viewer editing a URL by hand; the first value is the answer. */
const first = (value: string | readonly string[] | undefined): string | undefined =>
  typeof value === "string" ? value : value?.[0];

/** A value outside a closed vocabulary is not a value (R-T26): it is dropped, and the default stands. */
const oneOf = <Value extends string>(
  vocabulary: readonly Value[],
  text: string | undefined,
): Value | undefined => vocabulary.find((value) => value === text);

/** An open-vocabulary id — a Repository, Team, Member or session key. Shape only; see R-V9. */
const identifier = (text: string | undefined): string | undefined =>
  text && text.length > 0 && text.length <= 64 ? text : undefined;

const civilDate = (text: string | undefined): string | undefined =>
  text && CIVIL_DATE.test(text) ? text : undefined;

/** `?per_capita=1` is the only form that turns a toggle on; `0` turns it off, and nothing else
 *  is an answer. R-M14 makes raw the default, so absence and `0` are the same state. */
const flag = (text: string | undefined): boolean | undefined =>
  ["1", "0"].includes(text ?? "") ? text === "1" : undefined;

const sortToken = (sort: ControlSet["sort"]): string =>
  sort.direction === "desc" ? `-${sort.column}` : sort.column;

/** `-cost` / `cost`. A column the People table does not carry is not a sort (R-N15, A24). */
const parseSort = (text: string | undefined): ControlSet["sort"] | undefined => {
  if (!text) return undefined;
  const direction = text.startsWith("-") ? "desc" : "asc";
  const column = text.startsWith("-") ? text.slice(1) : text;
  const known = PEOPLE_SORT_COLUMNS.some((option) => option.value === column);
  return known ? { column, direction } : undefined;
};

/** Drops the keys a parse produced nothing for, so an absent parameter cannot overwrite a default. */
const defined = <Shape extends object>(shape: Shape): Partial<Shape> =>
  Object.fromEntries(
    Object.entries(shape).filter(([, value]) => value !== undefined),
  ) as Partial<Shape>;

type Reader = (key: ControlKey) => string | undefined;

/** R-C1 — a page reads only the controls it declares. Everything else is not on this page. */
const readerFor = (page: PageKey, query: ControlQuery): Reader => {
  const declared = new Set(DECLARED_CONTROLS[page]);
  return (key) => (declared.has(key) ? first(query[QUERY_KEYS[key]]) : undefined);
};

export type ParseInput = {
  readonly page: PageKey;
  readonly orgSlug: string;
  /** The Organization's observation window — the default period, and the bound every range sits in. */
  readonly window: PeriodRange;
  readonly now: string;
  readonly query: ControlQuery;
};

/**
 * The range this page's period control resolved to.
 *
 * A free `from`/`to` range is **clipped into the observation window** rather than taken as
 * written: outside it there are no rows, and an unclipped range is an unbounded number of empty
 * buckets to render. A range that survives the clip inverted asked for a period the product has
 * no data for at all, which is not a period — the page default stands (R-C4).
 */
const rangeFrom = (input: ParseInput): PeriodRange => {
  const declared = new Set(DECLARED_CONTROLS[input.page]);
  if (declared.has("dateRange")) {
    const start = civilDate(first(input.query[QUERY_KEYS.dateRange]));
    const end = civilDate(first(input.query[RANGE_END_KEY]));
    if (!start || !end) return input.window;
    const clipped = {
      start: later(start, input.window.start),
      end: earlier(end, input.window.end),
    };
    return clipped.start <= clipped.end ? clipped : input.window;
  }
  if (!declared.has("period")) return input.window;
  const token = first(input.query[QUERY_KEYS.period]);
  const offered = periodOptions(input.page, input.window).find((option) => option.value === token);
  // A token this page does not offer is not a period: the page default stands (R-C4, R-T26).
  return offered?.range ?? defaultPeriodRange(input.page, input.window);
};

/**
 * `?member=` on `/demo/people` and `?session=` on `/demo/history` address a **surface**, not a
 * panel (R-N16, R-N20.1). They serialise and they survive a control change, but they are not in
 * `DECLARED_CONTROLS` and the toolbar never offers them — that is the distinction R-C1 draws.
 */
const surfaceParams = (page: PageKey, query: ControlQuery): Partial<ControlSet> =>
  defined({
    member: page === "people" ? identifier(first(query[QUERY_KEYS.member])) : undefined,
    session: page === "history" ? identifier(first(query[SESSION_KEY])) : undefined,
  });

/**
 * **`searchParams` → a validated `ControlSet`.** The only expression in the program that turns a
 * URL into something a query will accept.
 *
 * Every invalid value has already been resolved by the time this returns: an unknown vocabulary
 * member is gone, a malformed range is gone, and `controlsWith` has re-run `coerceGrain`, so day
 * grain over a long range (R-M11, A3) leaves here as a grain the range can carry.
 */
export function parseControls(input: ParseInput): ControlSet {
  const read = readerFor(input.page, input.query);
  const range = rangeFrom(input);
  const base = defaultControls({
    page: input.page,
    orgSlug: input.orgSlug,
    range,
    now: input.now,
  });

  return controlsWith(base, {
    ...defined({
      grain: oneOf(CONTROL_VOCABULARIES.grain, read("grain")),
      subject: oneOf(CONTROL_VOCABULARIES.subject, read("subject")),
      repository: identifier(read("repository")),
      workType: oneOf(CONTROL_VOCABULARIES.workType, read("workType")),
      accepted: oneOf(CONTROL_VOCABULARIES.accepted, read("accepted")),
      perCapita: flag(read("perCapita")),
      modelLevel: oneOf(CONTROL_VOCABULARIES.modelLevel, read("modelLevel")),
      executionMode: oneOf(CONTROL_VOCABULARIES.executionMode, read("executionMode")),
      team: identifier(read("team")),
      memberKind: oneOf(CONTROL_VOCABULARIES.memberKind, read("memberKind")),
      sort: parseSort(read("sort")),
      member: identifier(read("member")),
    }),
    ...surfaceParams(input.page, input.query),
  });
}

// --- Serialising --------------------------------------------------------------------------

/** R-C4 — a parameter equal to the page default is omitted, so a bare route is canonical. */
const unlessDefault = (value: unknown, fallback: unknown, text: string): string | null =>
  value === fallback ? null : text;

type Entry = readonly [ControlKey, string | null];

const scalarEntries = (controls: ControlSet, base: ControlSet): readonly Entry[] => [
  ["grain", unlessDefault(controls.grain, base.grain, controls.grain)],
  ["subject", unlessDefault(controls.subject, base.subject, controls.subject)],
  ["repository", controls.repository],
  ["workType", controls.workType],
  ["accepted", unlessDefault(controls.accepted, base.accepted, controls.accepted)],
  ["perCapita", unlessDefault(controls.perCapita, base.perCapita, "1")],
  ["modelLevel", unlessDefault(controls.modelLevel, base.modelLevel, controls.modelLevel)],
  ["executionMode", controls.executionMode],
  ["team", controls.team],
  ["memberKind", controls.memberKind],
  ["sort", unlessDefault(sortToken(controls.sort), sortToken(base.sort), sortToken(controls.sort))],
  ["member", controls.member],
];

const putRange = (query: URLSearchParams, controls: ControlSet, bounds: PeriodRange): void => {
  const declared = new Set(DECLARED_CONTROLS[controls.page]);
  if (declared.has("dateRange")) {
    if (rangeEquals(controls.range, bounds)) return;
    query.set(QUERY_KEYS.dateRange, controls.range.start);
    query.set(RANGE_END_KEY, controls.range.end);
    return;
  }
  if (!declared.has("period")) return;
  // R-C4 — against the *page's* default period, which is not the window on every page.
  if (rangeEquals(controls.range, defaultPeriodRange(controls.page, bounds))) return;
  const token = tokenFor(controls.page, controls.range, bounds);
  if (token) query.set(QUERY_KEYS.period, token);
};

/**
 * **The canonical query string for a control set.** Empty exactly when every control sits at its
 * page default, which is what makes the bare route the short form (R-C4) and "reset" a link with
 * no query on it at all.
 *
 * `now` is not here and has no key: P5 makes it an argument, not a control.
 */
export function canonicalQuery(controls: ControlSet, bounds: PeriodRange): URLSearchParams {
  const declared = new Set(DECLARED_CONTROLS[controls.page]);
  const base = defaultControls({
    page: controls.page,
    orgSlug: controls.orgSlug,
    range: controls.range,
    now: controls.now,
  });

  const query = new URLSearchParams();
  putRange(query, controls, bounds);
  for (const [key, value] of scalarEntries(controls, base)) {
    if (value !== null && declared.has(key)) query.set(QUERY_KEYS[key], value);
  }
  // The surface parameters (R-N16, R-N20.1) are addressable but undeclared, so they are written
  // here rather than through the declared loop — a control change must not drop the surface.
  if (controls.page === "people" && controls.member) query.set(QUERY_KEYS.member, controls.member);
  if (controls.page === "history" && controls.session) query.set(SESSION_KEY, controls.session);
  return query;
}

/** What a control link changes. The same shape `controlsWith` takes, so grain is always re-coerced. */
export type ControlOverrides = Partial<Omit<ControlSet, "page" | "orgSlug" | "now">>;

/**
 * **A link that sets a control.** Every control in the toolbar is one of these: an `<a href>`
 * whose target is the same page with one value changed. There is no handler, no client state and
 * nothing to keep in sync — the browser's own navigation writes the URL, and the next render
 * reads it back (R-T25).
 */
export function controlHref(input: {
  readonly controls: ControlSet;
  readonly window: PeriodRange;
  readonly overrides?: ControlOverrides;
}): string {
  const next = input.overrides ? controlsWith(input.controls, input.overrides) : input.controls;
  const query = canonicalQuery(next, input.window).toString();
  const path = pathFor(next.page, next.orgSlug);
  return query ? `${path}?${query}` : path;
}

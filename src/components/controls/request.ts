// Everything a controlled page needs, resolved once: who is asking, what the URL asked for, and
// the options the toolbar offers.
//
// **It re-resolves the viewer even though `[org]/layout.tsx` already did.** A layout and the page
// inside it render *in parallel* in the App Router — the page does not wait for the layout and
// cannot read its result — so a page that assumed the layout had already refused would be reached
// on its own terms by a request the layout was about to refuse. R-T15's boundary is the layout;
// this is the same three outcomes taken again by the surface that would otherwise render without
// them. `loadDataset` is memoised and the JWT verification is one HMAC, so the cost is not the
// reason to skip it.
//
// **`now` and the observation window arrive here and nowhere else** (P5). Everything below this
// point takes them as arguments, which is what keeps `src/domain` clock-free and the queries
// reproducible. The as-of stamp (R-N3.1) rides with them: it is the third of `clock.ts`'s answers
// to "when", it is a property of the dataset rather than of this request's controls, and it is
// resolved once here so six surfaces cannot print six different freshness claims.
//
// **One clock read, and everything else derived from it** (ticket 62). `requestNow()` is called
// once; the window is that instant's cut of the declared window, the controls are parsed against
// that window, the toolbar's options are read off that instant's slice of the data, and the as-of
// stamp names the last session inside it. Reading the clock twice on one request is how a page
// comes to hold a window that ends before the row at the top of its own table.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Viewer } from "@/domain/access";
import type { PeriodRange } from "@/domain/periods";
import type { Account } from "@/data/accounts";
import { dataAsOf, observationWindow, requestNow, type DataAsOf } from "@/data/clock";
import type { ControlSet, PageKey } from "@/data/params";
import { controlOptions, type ControlOptions } from "@/data/queries";
import { SESSION_COOKIE } from "@/data/session-cookie";
import { resolveViewer } from "@/data/viewer";
import { parseControls, type ControlQuery } from "./schema";

export type PageRequest = {
  readonly viewer: Viewer;
  readonly account: Account;
  /** The parsed, validated, coerced control set — the only thing a query is ever handed. */
  readonly controls: ControlSet;
  readonly options: ControlOptions;
  /**
   * The observation window this request reads: the Organization's declared window, cut at `now`
   * (R-D2, ticket 62). A control tells "default" from "chosen" against it, and no control it
   * bounds can name a day the product has no data for yet.
   */
  readonly window: PeriodRange;
  /**
   * R-N3.1 — how fresh the rows behind this page are. `null` only for an Organization holding no
   * session at all, which `demo` never is (R-E1); the type carries the case rather than asserting
   * it away.
   */
  readonly asOf: DataAsOf | null;
};

/**
 * **A page's request.** `searchParams` in, a `ControlSet` and its options out.
 *
 * The `ControlSet` this returns is the *only* representation of control state the page has: there
 * is no store, no context and no state hook holding a second copy (R-T25). Changing a control
 * means following a link, which produces a different URL, which produces a different call here.
 */
export async function pageRequest(
  page: PageKey,
  orgSlug: string,
  query: ControlQuery,
): Promise<PageRequest> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const resolution = await resolveViewer(token, orgSlug);
  if (resolution.outcome === "no-session") redirect("/sign-in");
  // R-A7 — 404 and never 403, for an unknown slug and for another Organization's token alike.
  if (resolution.outcome === "not-found") notFound();

  const now = requestNow();
  const bounds = observationWindow(now);
  const controls = parseControls({ page, orgSlug, window: bounds, now, query });
  return {
    viewer: resolution.viewer,
    account: resolution.account,
    controls,
    options: controlOptions(resolution.viewer, controls),
    window: bounds,
    asOf: dataAsOf(now),
  };
}

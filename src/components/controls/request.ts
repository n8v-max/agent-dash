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
// reproducible.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Viewer } from "@/domain/access";
import type { PeriodRange } from "@/domain/periods";
import type { Account } from "@/data/accounts";
import { observationWindow, requestNow } from "@/data/clock";
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
  /** The Organization's observation window, so a control can tell "default" from "chosen". */
  readonly window: PeriodRange;
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

  const bounds = observationWindow();
  const controls = parseControls({ page, orgSlug, window: bounds, now: requestNow(), query });
  return {
    viewer: resolution.viewer,
    account: resolution.account,
    controls,
    options: controlOptions(resolution.viewer, controls),
    window: bounds,
  };
}

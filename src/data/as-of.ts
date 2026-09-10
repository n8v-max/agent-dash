// Boundary 1's second cut — **the dataset as it stood at `now`** (ticket 62).
//
// `load.ts` strips hidden rows once, at parse, because "a per-query filter is a filter somebody
// eventually forgets" (its line 14). This module applies the same argument to the *other* filter
// the product needs, and for the same reason: from ticket 66 the committed fixture runs past
// today, and every surface — six page queries, the toolbar's options, the observation window, the
// as-of stamp and the projection — must show rows up to the current instant and nothing later.
// Twenty per-query `ended_at` comparisons would be twenty chances to forget one, and the one that
// was forgotten would print a session that has not happened yet.
//
// Three properties, each load-bearing:
//
//   * **A session is observable at its end** (`domain/observation.ts`, `CONTEXT.md` § Session
//     measures). A session still running at `now` has no cost, no token usage and no outcome that
//     the platform could have read, so it is not yet a row — the cut is on `ended_at`, never on
//     `started_at`. A session ending *exactly* at `now` has just been observed and is kept.
//   * **Children follow their root.** A root that survives keeps its whole fan-out; a root that is
//     cut takes its children with it. The converse — a child outliving the root it rolls up into —
//     cannot exist, and `sessions.fixture.test.ts` asserts that of the committed data
//     (`child.ended_at < root.ended_at`), so the roll-up `load.ts` already performed stays true of
//     the slice: the surviving root's folded cost is folded from rows that had all finished.
//   * **The unsliced dataset is returned unchanged when nothing is dropped**, identity included.
//     Until ticket 66 extends the window, `now` is at or past the last `ended_at` on most reads,
//     and a caller then holds the very object `loadDataset()` memoised.
//
// This module reads no clock (P5): `now` is a parameter, exactly as it is on `ControlSet`. It is
// the only module besides `load.ts` and `clock.ts` that calls `loadDataset`, and `as-of.test.ts`
// asserts that as an absence over the source.

import type { AgentSession } from "@/domain/types";
import { loadDataset, type Dataset } from "./load";

/**
 * How many slices are held at once. A page's queries all share one `now` string, so one entry
 * serves a whole render; the rest is headroom for a dev server serving several requests at once,
 * and the bound is what stops a long-lived process accumulating one dataset per request.
 */
const CACHE_LIMIT = 4;

const cache = new Map<string, Dataset>();

/**
 * The rows as of `cut`, or the dataset itself where the cut removes nothing.
 *
 * Returning the input unchanged is not an optimisation: it is what makes "the slice is a no-op
 * until the data runs past today" a property a test can assert by identity rather than by
 * comparing 742 rows field by field.
 */
const sliceTo = (data: Dataset, cut: number): Dataset => {
  const sessions = data.sessions.filter((row) => Date.parse(row.ended_at) <= cut);
  if (sessions.length === data.sessions.length) return data;

  const childSessions = new Map<string, readonly AgentSession[]>();
  for (const root of sessions) {
    const spawned = data.childSessions.get(root.id);
    if (spawned !== undefined) childSessions.set(root.id, spawned);
  }
  return { ...data, sessions, childSessions };
};

/** Insertion-ordered eviction — the oldest slice goes, which is the one no request still holds. */
const remember = (key: string, sliced: Dataset): Dataset => {
  cache.set(key, sliced);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return sliced;
};

/**
 * **The dataset the application reads: the committed fixture, cut at `now`.**
 *
 * Every query goes through this and none of them filters on `ended_at` itself — `queries.ts`'s
 * `pageContext` and `controlOptions` are the only callers, and `clock.ts` reads the same slice for
 * the as-of stamp, so the freshness claim and the rows behind it cannot disagree.
 *
 * `now` must be an ISO 8601 instant. It is a fault rather than a fallback: falling back to the
 * whole dataset would put rows from the future on the page, and falling back to an empty one would
 * manufacture the zero-data state R-E1 says the product does not have. `requestNow()` is the only
 * production producer of the value and it cannot return a bad one.
 */
export const datasetAsOf = (now: string): Dataset => {
  const cut = Date.parse(now);
  if (Number.isNaN(cut)) {
    throw new TypeError(
      `datasetAsOf: ${JSON.stringify(now)} is not an ISO 8601 instant. The slice is the ` +
        "product's answer to what has happened yet, so it has no meaning without one.",
    );
  }
  return cache.get(now) ?? remember(now, sliceTo(loadDataset(), cut));
};

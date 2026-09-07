// Output comparability — `CONTEXT.md` § Work (**Output comparability**), `spec.md` R-M8 / R-M6 /
// A23, `technical-spec.md` § 3.2, ticket 26. Tested by T-U4 (and named again as T-U9).
//
// **The map is data and comparability is its intersection.** Each WorkType declares the artefact
// kinds it may produce and the acceptance criterion it is judged against; two WorkTypes are
// comparable on output where those artefact sets intersect, and comparable on acceptance where
// the criteria are equal. Neither relation is written down anywhere in this module — both are
// computed from the catalogue the caller hands in, which is the fixture's `work_types.json`.
// § 3.2 puts the intersection here rather than in a chart component for the obvious reason: a
// convention inside a component is a convention the next component does not have.
//
// **The direction is the reverse of the obvious one.** The obvious API is a validator —
// `comparable(a, b)` — which rejects an incomparable selection *after* someone expressed it.
// R-M8 and A23 ask for the opposite: *"choosing a datapoint conditions which WorkTypes are
// offered, so an incomparable selection cannot be expressed in the first place."* So the query
// this module exports takes a **datapoint** and returns **the WorkTypes that may be offered**
// beside it. A UI builds its control out of that set, and the incomparable pairing is
// unrepresentable rather than caught. There is deliberately **no exported boolean** taking two
// WorkTypes: adding one would restore the rejected-after-the-fact direction and the
// unrepresentability claim would quietly become a convention again.
//
// What the committed catalogue makes of that (T-U4, and asserted in `src/data/`):
//
//   * `implementation`, `bugfix` and `refactor` share `pull_request`, `commit`, `file_changed`
//     and `line_changed` — comparable with each other on every one of them — **and** they share
//     an acceptance criterion, which is what keeps R-M6 true: their acceptance rates are the
//     only ones this product may put side by side.
//   * `review` produces `pr_comment` alone, so it is comparable with neither code type. **The
//     one live case the fixture keeps**, and the reason the rule is testable at all.
//   * `deploy` produces `commit` and `pr_comment`: it shares `commit` with the code types and
//     `pr_comment` with `review`, and shares an acceptance criterion with neither. Output
//     comparability and acceptance comparability are therefore genuinely different relations
//     over the same five keys, not one relation named twice.
//
// This module is PURE (R-T5): no React, no Next, no fs, no JSON, no wall clock, no environment.

import type { ArtefactKind, WorkType, WorkTypeKey } from "./types";

/**
 * The minimum comparability reads from a WorkType. `WorkType` satisfies it structurally, so the
 * catalogue is the fixture's own rows rather than a copy of them kept in sync by hand.
 */
export type WorkTypeFacts = Readonly<Pick<WorkType, "key" | "acceptance_criterion" | "artefact_kinds">>;

/**
 * The measures whose comparability differs. Output counts are comparable through the artefact
 * map; acceptance rates through the criterion. `CONTEXT.md` names exactly these two, and a
 * measure absent here has no comparability question because nothing else is compared across
 * WorkTypes at all.
 */
export const COMPARABILITY_MEASURES = ["artefact_count", "acceptance_rate"] as const;
export type ComparabilityMeasure = (typeof COMPARABILITY_MEASURES)[number];

/**
 * What a viewer chose first. A **datapoint**, not a pair — the whole point of the direction.
 *
 * `acceptance_rate` carries a WorkType because R-M6 makes acceptance rate a figure that exists
 * only *within* one: there is no criterion-free acceptance datapoint to ask about, so the
 * variant that would let someone request a cross-WorkType acceptance figure is not in the union.
 */
export type ComparabilityDatapoint =
  | { readonly measure: "artefact_count"; readonly artefact: ArtefactKind }
  | { readonly measure: "acceptance_rate"; readonly workType: WorkTypeKey };

/**
 * The catalogue, indexed. Every field is a lookup built by the same pass over the same rows, so
 * the offer a control is built from and the intersection a caption names cannot disagree.
 */
export type Comparability = {
  /** The catalogue's keys, in catalogue order. Every set below is a subset of these. */
  readonly workTypes: readonly WorkTypeKey[];
  /** The map itself — WorkType → the artefact kinds it may produce. The data R-M8 calls data. */
  readonly artefacts: ReadonlyMap<WorkTypeKey, readonly ArtefactKind[]>;
  /**
   * **A23, the offer direction.** Artefact kind → the WorkTypes producing it.
   *
   * A `Record` rather than a `Map`, because the artefact vocabulary is closed: every kind is
   * keyed, so a kind nothing produces answers with an empty set rather than with `undefined`,
   * and that is a guarantee of the type rather than a fallback someone has to remember. An
   * unanswered question and an answer of "none" are different things. The WorkType-keyed maps
   * below are `Map`s for the opposite reason: their keys come from the *catalogue*, which is
   * data, so a key the catalogue does not hold is a real possibility.
   */
  readonly producers: Readonly<Record<ArtefactKind, readonly WorkTypeKey[]>>;
  /**
   * WorkType → the WorkTypes sharing at least one artefact kind with it, itself included.
   *
   * A WorkType permitted no artefact kind at all would intersect with nothing — not even
   * itself, because there is no count to put on an axis. That state is unreachable in the
   * committed catalogue and is left as the arithmetic rather than special-cased.
   */
  readonly outputPeers: ReadonlyMap<WorkTypeKey, readonly WorkTypeKey[]>;
  /** WorkType → the WorkTypes sharing its acceptance criterion, itself included (R-M6). */
  readonly acceptancePeers: ReadonlyMap<WorkTypeKey, readonly WorkTypeKey[]>;
};

/** The answer to a question about a key the catalogue does not hold: none, never `undefined`. */
const NONE: readonly WorkTypeKey[] = [];
const NO_ARTEFACTS: readonly ArtefactKind[] = [];

const intersects = (left: readonly ArtefactKind[], right: readonly ArtefactKind[]): boolean =>
  left.some((kind) => right.includes(kind));

/**
 * Indexes a catalogue. One pass, four lookups, and no relation stated in code: swap the
 * catalogue and every answer below changes with it, which is what "the map is data" means.
 */
export function comparability(catalogue: readonly WorkTypeFacts[]): Comparability {
  const producing = (kind: ArtefactKind): readonly WorkTypeKey[] =>
    catalogue.filter((workType) => workType.artefact_kinds.includes(kind)).map((workType) => workType.key);

  const peers = (
    matches: (left: WorkTypeFacts, right: WorkTypeFacts) => boolean,
  ): ReadonlyMap<WorkTypeKey, readonly WorkTypeKey[]> =>
    new Map(
      catalogue.map((workType) => [
        workType.key,
        catalogue.filter((other) => matches(workType, other)).map((other) => other.key),
      ]),
    );

  return {
    workTypes: catalogue.map((workType) => workType.key),
    artefacts: new Map(catalogue.map((workType) => [workType.key, workType.artefact_kinds])),
    // Written out rather than derived from `ARTEFACT_KINDS`, because `Record<ArtefactKind, …>`
    // makes the compiler check the five are all here — a sixth kind added to the vocabulary
    // would fail to compile instead of silently answering `undefined`.
    producers: {
      pull_request: producing("pull_request"),
      commit: producing("commit"),
      file_changed: producing("file_changed"),
      line_changed: producing("line_changed"),
      pr_comment: producing("pr_comment"),
    },
    outputPeers: peers((left, right) => intersects(left.artefact_kinds, right.artefact_kinds)),
    acceptancePeers: peers((left, right) => left.acceptance_criterion === right.acceptance_criterion),
  };
}

/**
 * **A23 — given a datapoint, the WorkTypes that may be offered beside it.**
 *
 * This is the only query in the module, and it is the reason there is no validator: a control
 * built from this set cannot express an incomparable selection, so nothing downstream has to
 * detect one. An artefact count offers every WorkType producing that kind; an acceptance rate
 * offers every WorkType judged by the same criterion — which, for `review` and for `deploy`,
 * is a set of exactly one, and that is R-M6 falling out of the data rather than being enforced.
 */
export function offeredWorkTypes(
  map: Comparability,
  datapoint: ComparabilityDatapoint,
): readonly WorkTypeKey[] {
  if (datapoint.measure === "artefact_count") return map.producers[datapoint.artefact];
  return map.acceptancePeers.get(datapoint.workType) ?? NONE;
}

/**
 * The intersection itself — what two WorkTypes are comparable *on*. Not a permission check: it
 * is the evidence behind an offer, for a caption that has to name the shared kinds ("comparable
 * on commits") rather than assert comparability and leave a reader to take it on faith.
 */
export function sharedArtefactKinds(
  map: Comparability,
  left: WorkTypeKey,
  right: WorkTypeKey,
): readonly ArtefactKind[] {
  const held = map.artefacts.get(right) ?? NO_ARTEFACTS;
  return (map.artefacts.get(left) ?? NO_ARTEFACTS).filter((kind) => held.includes(kind));
}

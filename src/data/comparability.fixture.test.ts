// T-U4 against the **committed** fixture (`spec.md` R-M8, R-M6, A23, R-D19, P6), ticket 26.
//
// The pure unit tests live in `src/domain/comparability.test.ts` and author the catalogue
// inline, because `src/domain/**` may not reach the data layer (R-T5). This file sits outside
// that boundary, so it may import `load.ts` — and it exists because P6 says a test that would
// pass against an empty fixture is not a test. Here the catalogue is the shipped
// `work_types.json`, which is what R-M8 means by *"the map is data"*: the intersection this
// module computes is the one the product actually ships, not a copy of it kept in sync by hand.
//
// The committed sessions give the claim teeth twice over: every session's artefact counts are
// restricted to its WorkType's permitted kinds, so a datapoint offered for a WorkType really
// does have a count behind it on every one of that type's rows, and a WorkType the offer
// withholds really does have nothing to put on the axis.
//
// It reads committed output and never runs the generator (P3, R-T20).

import { describe, expect, it } from "vitest";
import {
  comparability,
  offeredWorkTypes,
  sharedArtefactKinds,
  type ComparabilityDatapoint,
} from "@/domain/comparability";
import { ARTEFACT_KINDS, type ArtefactKind, type WorkTypeKey } from "@/domain/types";
import { loadDataset } from "./load";

const { workTypes, sessions } = loadDataset();

const MAP = comparability(workTypes);
const CODE_TYPES: readonly WorkTypeKey[] = ["implementation", "bugfix", "refactor"];

const offered = (datapoint: ComparabilityDatapoint): readonly WorkTypeKey[] =>
  [...offeredWorkTypes(MAP, datapoint)].sort();

const forArtefact = (artefact: ArtefactKind): readonly WorkTypeKey[] =>
  offered({ measure: "artefact_count", artefact });

describe("T-U4 — the intersection over the shipped catalogue (R-M8)", () => {
  it("indexes all five WorkTypes the fixture ships", () => {
    expect(MAP.workTypes).toEqual(["implementation", "bugfix", "refactor", "review", "deploy"]);
  });

  it("has the three code types sharing all four code artefact kinds", () => {
    const code: readonly ArtefactKind[] = ["pull_request", "commit", "file_changed", "line_changed"];
    expect(sharedArtefactKinds(MAP, "implementation", "bugfix")).toEqual(code);
    expect(sharedArtefactKinds(MAP, "implementation", "refactor")).toEqual(code);
    expect(sharedArtefactKinds(MAP, "bugfix", "refactor")).toEqual(code);
  });

  it("keeps `review` on `pr_comment` alone — the one live incomparable case", () => {
    expect(MAP.artefacts.get("review")).toEqual(["pr_comment"]);
    for (const code of CODE_TYPES) {
      expect(sharedArtefactKinds(MAP, "review", code)).toEqual([]);
      expect(sharedArtefactKinds(MAP, code, "review")).toEqual([]);
    }
  });

  it("has `deploy` sharing `commit` with the code types and `pr_comment` with `review`", () => {
    expect(MAP.artefacts.get("deploy")).toEqual(["commit", "pr_comment"]);
    for (const code of CODE_TYPES) {
      expect(sharedArtefactKinds(MAP, "deploy", code)).toEqual(["commit"]);
    }
    expect(sharedArtefactKinds(MAP, "deploy", "review")).toEqual(["pr_comment"]);
  });
});

describe("A23 — choosing a datapoint conditions which WorkTypes are offered", () => {
  it("offers only the three code types for a pull request, file or line datapoint", () => {
    for (const artefact of ["pull_request", "file_changed", "line_changed"] as const) {
      expect(forArtefact(artefact)).toEqual(["bugfix", "implementation", "refactor"]);
    }
  });

  it("offers the code types and `deploy` for commits, and `review` and `deploy` for comments", () => {
    expect(forArtefact("commit")).toEqual(["bugfix", "deploy", "implementation", "refactor"]);
    expect(forArtefact("pr_comment")).toEqual(["deploy", "review"]);
  });

  it("offers acceptance rate only within a shared criterion, which is what keeps R-M6 true", () => {
    for (const code of CODE_TYPES) {
      expect(offered({ measure: "acceptance_rate", workType: code })).toEqual([
        "bugfix",
        "implementation",
        "refactor",
      ]);
    }
    expect(offered({ measure: "acceptance_rate", workType: "review" })).toEqual(["review"]);
    expect(offered({ measure: "acceptance_rate", workType: "deploy" })).toEqual(["deploy"]);
  });

  it("names each shipped criterion, and finds exactly three of them", () => {
    const criteria = new Set(workTypes.map((workType) => workType.acceptance_criterion));
    expect(criteria.size).toBe(3);
    // The code types' shared criterion is the published pull request; `review` and `deploy`
    // each have their own, which is why neither joins an acceptance comparison.
    expect(workTypes.find((workType) => workType.key === "review")?.acceptance_criterion).not.toBe(
      workTypes.find((workType) => workType.key === "implementation")?.acceptance_criterion,
    );
  });
});

describe("the offer matches what the committed sessions actually carry", () => {
  it("gives every offered WorkType a real count for the datapoint, on its own rows", () => {
    for (const artefact of ARTEFACT_KINDS) {
      for (const key of forArtefact(artefact)) {
        const rows = sessions.filter((session) => session.work_type === key);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every((session) => artefact in session.artefacts)).toBe(true);
      }
    }
  });

  it("gives every withheld WorkType nothing to put on the axis, on every one of its rows", () => {
    // The half that makes the offer meaningful: a WorkType the control does not show has no
    // count at all, so a chart built from the offer cannot be short a series it should have
    // had — and a chart built without it would be plotting an absent field as zero.
    for (const artefact of ARTEFACT_KINDS) {
      const withheld = MAP.workTypes.filter((key) => !forArtefact(artefact).includes(key));
      for (const key of withheld) {
        const rows = sessions.filter((session) => session.work_type === key);
        expect(rows.every((session) => !(artefact in session.artefacts))).toBe(true);
      }
    }
  });

  it("restricts every session's artefact counts to its own WorkType's permitted kinds", () => {
    const stray = sessions
      .filter((session) =>
        Object.keys(session.artefacts).some(
          (kind) => !(MAP.artefacts.get(session.work_type) ?? []).includes(kind as ArtefactKind),
        ),
      )
      .map((session) => session.id);
    expect(stray).toEqual([]);
  });
});

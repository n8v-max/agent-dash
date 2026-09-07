// T-U4 — the `WorkType → artefact kind` comparability intersection (`testing-spec.md` § 3.1 and
// § 3.2, `spec.md` R-M8, R-M6, A23), ticket 26. Also listed as T-U9.
//
// These are pure unit tests: `src/domain/**` may not reach the data layer (R-T5), so the
// catalogue below is authored inline. It is the *shape* of the committed `work_types.json` —
// the same five keys, the same artefact sets, the same three criteria — and the identical
// claims are re-asserted against the committed file in `src/data/comparability.fixture.test.ts`,
// because P6 says a test that would pass against an empty fixture is not a test.
//
// **The test this file must not contain.** T-U4 asks for the offer direction: *"given a
// datapoint, the function returns the WorkTypes that may be offered … so an incomparable
// selection is unrepresentable rather than rejected after the fact."* So there is no
// expectation below that an incomparable pair is *detected* or *refused*, because there is no
// function that could do it. The last describe asserts that absence over the module's own
// exports: a validator arriving later would fail a test rather than pass one.

import { describe, expect, it } from "vitest";
import * as comparabilityModule from "./comparability";
import {
  comparability,
  offeredWorkTypes,
  sharedArtefactKinds,
  type Comparability,
  type WorkTypeFacts,
} from "./comparability";
import { ARTEFACT_KINDS, type ArtefactKind, type WorkTypeKey } from "./types";

/** The two criteria the code types and `review` are judged by, plus `deploy`'s own. */
const PULL_REQUEST_PUBLISHED = "A pull request was published";
const REVIEW_SUBMITTED = "A review was submitted with an outcome";
const COMMIT_LANDED = "A commit landed on the default branch";

const CODE_ARTEFACTS: readonly ArtefactKind[] = [
  "pull_request",
  "commit",
  "file_changed",
  "line_changed",
];

const CATALOGUE: readonly WorkTypeFacts[] = [
  { key: "implementation", acceptance_criterion: PULL_REQUEST_PUBLISHED, artefact_kinds: [...CODE_ARTEFACTS] },
  { key: "refactor", acceptance_criterion: PULL_REQUEST_PUBLISHED, artefact_kinds: [...CODE_ARTEFACTS] },
  { key: "bugfix", acceptance_criterion: PULL_REQUEST_PUBLISHED, artefact_kinds: [...CODE_ARTEFACTS] },
  { key: "review", acceptance_criterion: REVIEW_SUBMITTED, artefact_kinds: ["pr_comment"] },
  { key: "deploy", acceptance_criterion: COMMIT_LANDED, artefact_kinds: ["commit", "pr_comment"] },
];

const MAP: Comparability = comparability(CATALOGUE);

const offeredFor = (artefact: ArtefactKind): readonly WorkTypeKey[] =>
  offeredWorkTypes(MAP, { measure: "artefact_count", artefact });

const acceptanceFor = (workType: WorkTypeKey): readonly WorkTypeKey[] =>
  offeredWorkTypes(MAP, { measure: "acceptance_rate", workType });

const sorted = (keys: readonly WorkTypeKey[]): readonly WorkTypeKey[] => [...keys].sort();

describe("the three code WorkTypes are comparable with each other (T-U4)", () => {
  it("has implementation, bugfix and refactor sharing all four code artefact kinds", () => {
    for (const other of ["bugfix", "refactor"] as const) {
      expect(sharedArtefactKinds(MAP, "implementation", other)).toEqual(CODE_ARTEFACTS);
    }
    expect(sharedArtefactKinds(MAP, "bugfix", "refactor")).toEqual(CODE_ARTEFACTS);
  });

  it("offers exactly the three of them for a pull-request, file or line datapoint", () => {
    for (const artefact of ["pull_request", "file_changed", "line_changed"] as const) {
      expect(sorted(offeredFor(artefact))).toEqual(["bugfix", "implementation", "refactor"]);
    }
  });

  it("lists each of them as its own output peer, and never `review`", () => {
    expect(sorted(MAP.outputPeers.get("implementation") ?? [])).toEqual([
      "bugfix",
      "deploy",
      "implementation",
      "refactor",
    ]);
    expect(MAP.outputPeers.get("implementation")).not.toContain("review");
  });
});

describe("`review` is comparable with neither code type — the one live case (T-U4)", () => {
  it("produces `pr_comment` and nothing else", () => {
    expect(MAP.artefacts.get("review")).toEqual(["pr_comment"]);
  });

  it("shares no artefact kind with any code WorkType", () => {
    for (const code of ["implementation", "bugfix", "refactor"] as const) {
      expect(sharedArtefactKinds(MAP, "review", code)).toEqual([]);
      // The relation is symmetric, and asserting both directions is what proves it is an
      // intersection rather than a lookup that happens to read one way.
      expect(sharedArtefactKinds(MAP, code, "review")).toEqual([]);
    }
  });

  it("is offered for no datapoint any code WorkType is offered for", () => {
    for (const artefact of CODE_ARTEFACTS) {
      expect(offeredFor(artefact)).not.toContain("review");
    }
    expect(sorted(offeredFor("pr_comment"))).toEqual(["deploy", "review"]);
  });

  it("has itself and `deploy` as output peers — never a code type", () => {
    // T-U4's "comparable with neither of the others" is scoped by its own next clause:
    // `deploy` *does* share `pr_comment` with `review`. What `review` is comparable with
    // neither of is the three code WorkTypes, and that is what is asserted here.
    expect(sorted(MAP.outputPeers.get("review") ?? [])).toEqual(["deploy", "review"]);
    for (const code of ["implementation", "bugfix", "refactor"] as const) {
      expect(MAP.outputPeers.get("review")).not.toContain(code);
    }
  });
});

describe("`deploy` shares one kind with each side and a criterion with neither (T-U4)", () => {
  it("produces `commit` and `pr_comment`", () => {
    expect(MAP.artefacts.get("deploy")).toEqual(["commit", "pr_comment"]);
  });

  it("shares `commit` with the code types and `pr_comment` with `review`", () => {
    expect(sharedArtefactKinds(MAP, "deploy", "implementation")).toEqual(["commit"]);
    expect(sharedArtefactKinds(MAP, "deploy", "review")).toEqual(["pr_comment"]);
  });

  it("puts every WorkType on the `commit` datapoint, which is the widest offer there is", () => {
    expect(sorted(offeredFor("commit"))).toEqual([
      "bugfix",
      "deploy",
      "implementation",
      "refactor",
    ]);
    // `review` produces no commit, so the widest offer is still not all five.
    expect(offeredFor("commit")).not.toContain("review");
  });
});

describe("acceptance comparability is a different relation over the same keys (T-U4, R-M6)", () => {
  it("offers the three code WorkTypes for one another's acceptance rate", () => {
    for (const code of ["implementation", "bugfix", "refactor"] as const) {
      expect(sorted(acceptanceFor(code))).toEqual(["bugfix", "implementation", "refactor"]);
    }
  });

  it("offers `review` and `deploy` nothing but themselves — which is what keeps R-M6 true", () => {
    expect(acceptanceFor("review")).toEqual(["review"]);
    expect(acceptanceFor("deploy")).toEqual(["deploy"]);
  });

  it("disagrees with output comparability, so the two relations are genuinely two", () => {
    // `deploy` is an output peer of `implementation` (they share `commit`) and is not an
    // acceptance peer of it. One relation named twice could not produce this pair.
    expect(MAP.outputPeers.get("implementation")).toContain("deploy");
    expect(acceptanceFor("implementation")).not.toContain("deploy");
  });
});

describe("the map is data, not a relation written in code (R-M8)", () => {
  it("changes every answer when the catalogue changes", () => {
    const rewritten = comparability([
      { key: "review", acceptance_criterion: PULL_REQUEST_PUBLISHED, artefact_kinds: ["pull_request"] },
      { key: "implementation", acceptance_criterion: PULL_REQUEST_PUBLISHED, artefact_kinds: ["pull_request"] },
    ]);
    // The one case the shipped catalogue keeps incomparable becomes comparable, because
    // nothing about "review" is hard-coded anywhere in the module.
    expect(sharedArtefactKinds(rewritten, "review", "implementation")).toEqual(["pull_request"]);
    expect(sorted(offeredWorkTypes(rewritten, { measure: "artefact_count", artefact: "pull_request" }))).toEqual([
      "implementation",
      "review",
    ]);
  });

  it("keys every artefact kind in the vocabulary, answering `none` rather than `undefined`", () => {
    const narrow = comparability([
      { key: "review", acceptance_criterion: REVIEW_SUBMITTED, artefact_kinds: ["pr_comment"] },
    ]);
    expect(Object.keys(narrow.producers).sort()).toEqual([...ARTEFACT_KINDS].sort());
    expect(narrow.producers.line_changed).toEqual([]);
    expect(offeredWorkTypes(narrow, { measure: "artefact_count", artefact: "line_changed" })).toEqual([]);
  });

  it("answers `none` for a WorkType the catalogue does not hold, at either measure", () => {
    const narrow = comparability([
      { key: "deploy", acceptance_criterion: COMMIT_LANDED, artefact_kinds: ["commit"] },
    ]);
    expect(offeredWorkTypes(narrow, { measure: "acceptance_rate", workType: "review" })).toEqual([]);
    expect(sharedArtefactKinds(narrow, "review", "deploy")).toEqual([]);
    expect(sharedArtefactKinds(narrow, "deploy", "review")).toEqual([]);
  });

  it("makes a WorkType producing nothing comparable with nothing, itself included", () => {
    const empty = comparability([
      { key: "review", acceptance_criterion: REVIEW_SUBMITTED, artefact_kinds: [] },
      { key: "deploy", acceptance_criterion: COMMIT_LANDED, artefact_kinds: ["commit"] },
    ]);
    // There is no count to put on an axis, so there is no axis to share. Left as the
    // arithmetic rather than special-cased — and asserted so the arithmetic is a decision.
    expect(empty.outputPeers.get("review")).toEqual([]);
    expect(empty.acceptancePeers.get("review")).toEqual(["review"]);
  });
});

describe("the direction is the offer, never the rejection (A23)", () => {
  /** The module's runtime surface. A validator arriving later would show up here. */
  const exported = Object.entries(comparabilityModule)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
    .sort();

  it("exports one builder and two queries, and no verdict about a pair", () => {
    expect(exported).toEqual(["comparability", "offeredWorkTypes", "sharedArtefactKinds"]);
    // `sharedArtefactKinds` takes a pair and returns the *intersection* — evidence a caption
    // names, not a verdict. Nothing in the module returns a boolean about two WorkTypes.
    expect(typeof sharedArtefactKinds(MAP, "review", "deploy")).not.toBe("boolean");
    expect(sharedArtefactKinds(MAP, "review", "deploy")).toEqual(["pr_comment"]);
  });

  it("answers a datapoint with a set a control can be built from", () => {
    // A23 in one line: the offer is the set, so a UI has nothing incomparable to render.
    for (const kind of ARTEFACT_KINDS) {
      const offered = offeredFor(kind);
      expect(Array.isArray(offered)).toBe(true);
      for (const key of offered) {
        expect(MAP.artefacts.get(key)).toContain(kind);
      }
    }
  });
});

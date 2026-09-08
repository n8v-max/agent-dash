// **R-A10 — the read-only permission matrix, collapsed at the foot of `/demo/people`.**
//
// What this file asserts is what a component owes: that all 24 cells of the matrix it was handed
// render, that the panel is collapsed and carries no control, and that **the cells it draws are
// the ones it was given** — the open account's matrix and the restricted account's matrix render
// differently because their ViewModels differ, not because the component decided anything.
//
// **What it deliberately does not assert: whether the restricted account reaches this panel at
// all.** That is the open contradiction on this ticket. `spec.md` A28 and `testing-spec.md` T-E8
// say "the matrix renders for the open account and **not** for the restricted one"; R-A10 and
// `spec.md` § 11 C6 say in terms that **both** see it, each showing its own grants, because
// R-A3.1 grants `self` over every class — `access` included — to every Role. The domain layer
// ticket 21 built enforces R-A3.1 ahead of the grant list, so "the restricted account holds no
// `access`" is not expressible below this line, and `peoplePage` puts `matrix` on every arm of
// the ViewModel for both accounts.
//
// A test written to either reading would pin the losing one. The question is which spec text is
// current, which is a human decision (`.scratch/agent-dash/issues/35-demo-people.md` § Comments,
// AFK handover § 8) — so the assertion is left unwritten and named here rather than skipped.
// A28's traceability row cites T-U10 as evidence; T-U10 asserts the R-A3.1 invariant, which
// supports R-A10 and contradicts A28's prose, so it is not evidence for A28.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MATRIX_SUMMARY,
  MATRIX_TEST_ID,
  PermissionMatrixPanel,
  matrixCaption,
} from "./permission-matrix";
import { MATRIX_NOTE, OPEN_MATRIX, RESTRICTED_MATRIX } from "./people-viewmodels.fixture";

const panel = (): HTMLElement => screen.getByTestId(MATRIX_TEST_ID);

/** Every cell of the rendered matrix, read off its own coordinates, as `scope:class → granted`. */
const grantsShown = (): Record<string, string> =>
  Object.fromEntries(
    within(panel())
      .getAllByRole("cell")
      .map((cell) => [
        `${cell.getAttribute("data-scope")}:${cell.getAttribute("data-datapoint")}`,
        cell.getAttribute("data-granted") ?? "",
      ]),
  );

/** One cell, by its coordinates — the two dimensions the model is built on. */
const cellAt = (scope: string, datapoint: string): HTMLElement | undefined =>
  within(panel())
    .getAllByRole("cell")
    .find(
      (cell) =>
        cell.getAttribute("data-scope") === scope &&
        cell.getAttribute("data-datapoint") === datapoint,
    );

describe("the matrix is collapsed and read-only (R-A10)", () => {
  it("renders collapsed — `<details>` with no `open`, so the foot of the page stays quiet", () => {
    render(<PermissionMatrixPanel matrix={OPEN_MATRIX} />);

    expect(panel()).not.toHaveAttribute("open");
    expect(screen.getByText(MATRIX_SUMMARY)).toBeInTheDocument();
  });

  it("carries no control at all — read-only is what is written, not what is disabled", () => {
    render(<PermissionMatrixPanel matrix={OPEN_MATRIX} />);

    const inside = within(panel());
    expect(inside.queryAllByRole("checkbox")).toEqual([]);
    expect(inside.queryAllByRole("button")).toEqual([]);
    expect(inside.queryAllByRole("textbox")).toEqual([]);
    expect(inside.queryAllByRole("switch")).toEqual([]);
    expect(inside.queryAllByRole("radio")).toEqual([]);
    expect(inside.queryAllByRole("combobox")).toEqual([]);
  });

  it("names the Role it is showing, and says why the `self` row is always granted (R-A3.1)", () => {
    render(<PermissionMatrixPanel matrix={RESTRICTED_MATRIX} />);

    // The Role's name is on the summary, so it is legible with the panel still collapsed.
    expect(within(panel()).getByText(MATRIX_SUMMARY, { exact: false })).toHaveTextContent(
      RESTRICTED_MATRIX.roleName,
    );
    expect(
      screen.getByRole("table", { name: matrixCaption(RESTRICTED_MATRIX.roleName) }),
    ).toBeInTheDocument();
    expect(screen.getByText(MATRIX_NOTE)).toBeInTheDocument();
  });
});

describe("the matrix renders the grants it was handed, and nothing else", () => {
  it("draws all 24 cells of (subject scope × datapoint class)", () => {
    render(<PermissionMatrixPanel matrix={OPEN_MATRIX} />);

    expect(Object.keys(grantsShown())).toHaveLength(24);
    // Six scope rows plus the heading row.
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });

  it("shows the open account its own grants — `org-member` over all four classes", () => {
    render(<PermissionMatrixPanel matrix={OPEN_MATRIX} />);
    const cells = grantsShown();

    expect(cells["org-member:cost"]).toBe("true");
    expect(cells["org-member:access"]).toBe("true");
    expect(cells["team:cost"]).toBe("false");
    expect(cells["self:access"]).toBe("true");
  });

  it("shows the restricted account *its* grants — `team` over jobs and tokens, and no more", () => {
    render(<PermissionMatrixPanel matrix={RESTRICTED_MATRIX} />);
    const cells = grantsShown();

    expect(cells["team:jobs"]).toBe("true");
    expect(cells["team:tokens"]).toBe("true");
    // The two cells that make its tables short: no cost at Team scope, no naming at all.
    expect(cells["team:cost"]).toBe("false");
    expect(cells["org-member:jobs"]).toBe("false");
    // R-A3.1 — and it can always see its own data and its own permissions.
    expect(cells["self:cost"]).toBe("true");
    expect(cells["self:access"]).toBe("true");
  });

  it("marks a granted cell in words as well as in glyph, for a screen reader", () => {
    render(<PermissionMatrixPanel matrix={RESTRICTED_MATRIX} />);

    const granted = cellAt("team", "jobs");
    const ungranted = cellAt("team", "cost");

    expect(granted?.textContent).toContain("granted");
    // Substring-honest: "not granted" contains "granted", so the granted cell is checked for
    // the *absence* of the negation rather than the presence of the word.
    expect(granted?.textContent).not.toContain("not granted");
    expect(ungranted?.textContent).toContain("not granted");
  });
});

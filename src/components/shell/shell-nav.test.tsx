// **T-C16 — the shell nav is six links and no overflow** (R-N2, R-A8).
//
// The claim is an *absence* — the "⋯" disclosure that used to hold `/demo/history` and
// `/demo/projection` is gone — and an absence needs a positive control beside it or it passes
// against a nav that renders nothing at all. So the six labels are asserted as a list, in order,
// with their `href`s, and only then is the disclosure asserted missing.
//
// **Secondary is a weight, never a visibility.** R-N2 allows the two secondary surfaces to read
// smaller and to sit apart; it forbids them being hidden. Both halves are asserted: they are
// links a viewer can reach with no interaction, and they carry a different class from the four
// primary items, so "secondary" is a claim the markup actually makes rather than a comment.
//
// `usePathname` is the one thing this component reads, and it is stubbed rather than mocked
// away: the active item is a function of the path, and asserting `aria-current` is what makes
// the highlight a tested behaviour rather than a styling accident.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/demo/spend" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const { ShellNav } = await import("./shell-nav");

const ITEMS = [
  { href: "/demo", label: "Summary", secondary: false },
  { href: "/demo/spend", label: "Spend", secondary: false },
  { href: "/demo/work", label: "Work", secondary: false },
  { href: "/demo/people", label: "People", secondary: false },
  { href: "/demo/history", label: "History", secondary: true },
  { href: "/demo/projection", label: "Projection", secondary: true },
] as const;

const nav = () => screen.getByRole("navigation", { name: "Sections" });

const linksIn = (): readonly { label: string; href: string }[] =>
  within(nav())
    .getAllByRole("link")
    .map((link) => ({
      label: link.textContent ?? "",
      href: link.getAttribute("href") ?? "",
    }));

describe("T-C16 — History and Projection are nav items, not an overflow (R-N2)", () => {
  it("renders all six surfaces as links, in order", () => {
    render(<ShellNav items={[...ITEMS]} />);

    expect(linksIn()).toEqual(ITEMS.map((item) => ({ label: item.label, href: item.href })));
  });

  it("carries no disclosure, no overflow trigger and no ellipsis", () => {
    render(<ShellNav items={[...ITEMS]} />);

    expect(within(nav()).queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText("More sections")).toBeNull();
    expect(nav().innerHTML).not.toContain("<details");
    // The character itself, in case the disclosure returns wearing something other than a
    // `<details>`: "⋯" on a nav item is the shape R-N2 now forbids.
    expect(nav().textContent).not.toContain("⋯");
  });

  it("gives the two secondary items a lighter weight, and hides neither", () => {
    render(<ShellNav items={[...ITEMS]} />);

    const classOf = (label: string) =>
      within(nav()).getByRole("link", { name: label }).getAttribute("class") ?? "";

    for (const secondary of ["History", "Projection"]) {
      expect(classOf(secondary)).toContain("text-xs");
      expect(classOf(secondary)).not.toContain("text-sm");
    }
    for (const primary of ["Summary", "Spend", "Work", "People"]) {
      expect(classOf(primary)).toContain("text-sm");
    }
    // Right-aligned as a pair: the first secondary item opens the group, so the gap sits between
    // the four questions and the two surfaces rather than inside either.
    expect(classOf("History")).toContain("ml-auto");
    expect(classOf("Projection")).not.toContain("ml-auto");
    expect(within(nav()).getByRole("link", { name: "History" })).toBeVisible();
    expect(within(nav()).getByRole("link", { name: "Projection" })).toBeVisible();
  });

  it("marks the current route, including when it is a secondary one", () => {
    pathname.current = "/demo/projection";
    render(<ShellNav items={[...ITEMS]} />);

    expect(within(nav()).getByRole("link", { name: "Projection" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav()).getByRole("link", { name: "Spend" })).not.toHaveAttribute("aria-current");
    pathname.current = "/demo/spend";
  });

  it("carries no query into any nav href (R-C5, R-T27)", () => {
    render(<ShellNav items={[...ITEMS]} />);

    for (const link of linksIn()) expect(link.href).not.toContain("?");
  });
});

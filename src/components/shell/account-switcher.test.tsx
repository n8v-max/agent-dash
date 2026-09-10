// **Ticket 61 — the switcher identifies the account and links out.**
//
// Every assertion here is about what the menu *is* now: the acting Member's name, their
// Organization's name, and one anchor to `/sign-in`. Three of them are absences, and absences
// are the point of this ticket — the "Switch account" heading, the Role line, the Organization
// group and the closing paragraph about "fewer rows" are all gone, and a test that only checked
// the positives would pass against a menu that still carried every one of them.
//
// **The T-E4 line is asserted, not assumed.** The menu may carry the viewer's *own* name —
// R-A3.1 grants `self` over every class to every Role — and must carry no other person's. That
// is now structural rather than conditional: nothing in this component reads a list of accounts,
// so the only name it *can* render is the one it is handed. The test states it anyway, because
// "there is no way to regress" is a property of today's code and not of the requirement.
//
// No module mock: the component imports `Account` as a type only, so nothing here reaches the
// fixture and the account under test is a literal.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Account } from "@/data/accounts";
import { AccountSwitcher } from "./account-switcher";

const ALPHA: Account = {
  memberId: "mem_here",
  orgSlug: "alpha",
  orgName: "Alpha S.L.",
  fullName: "Héctor Camps",
  roleName: "Open default",
};

const menu = () => within(screen.getByTestId("switch-account"));

describe("the menu — who you are, where you are, one way on", () => {
  it("names the acting Member and their Organization, and nothing about their Role", () => {
    render(<AccountSwitcher account={ALPHA} />);

    expect(menu().getByText("Héctor Camps")).toBeInTheDocument();
    expect(menu().getByText("Alpha S.L.")).toBeInTheDocument();
    // The Role name is on the Account and is deliberately not rendered: R-A5 as amended drops
    // the mechanics, and the Role was the label the mechanics needed.
    expect(menu().queryByText(/Open default/)).toBeNull();
  });

  it("offers exactly one link, to /sign-in, labelled Add another account", () => {
    render(<AccountSwitcher account={ALPHA} />);

    const links = menu().getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("Add another account");
    expect(links[0]).toHaveAttribute("href", "/sign-in");
  });

  it("holds no form and no button: nothing here posts, and nothing here switches", () => {
    render(<AccountSwitcher account={ALPHA} />);

    // `document.forms` rather than a container query: an unnamed <form> has no ARIA role, so
    // Testing Library cannot see one at all, and the DOM's own registry of every form in the
    // rendered document is both the honest question and the stronger one.
    expect(document.forms).toHaveLength(0);
    expect(menu().queryAllByRole("button")).toHaveLength(0);
  });

  it("carries no copy about switching, roles, rows, grants or the restricted account", () => {
    render(<AccountSwitcher account={ALPHA} />);

    // The closing paragraph explained a mechanic that no longer exists; the Organization group
    // offered a second tenant the fixture does not hold. Both are asserted gone by their words,
    // because either could come back as prose without failing a structural count.
    expect(screen.getByTestId("switch-account").textContent).not.toMatch(
      /switch|row|restricted|grant|contractor|organisation/i,
    );
    expect(screen.queryByTestId("switch-organization")).toBeNull();
  });

  it("names the acting Member and nobody else (T-E4's line, at this layer)", () => {
    render(<AccountSwitcher account={{ ...ALPHA, fullName: "Nuria Castells" }} />);

    const rendered = screen.getByTestId("switch-account").textContent ?? "";

    expect(rendered).toContain("Nuria Castells");
    // Everything the menu says, spelled out: two facts and one action. A second person's name
    // could only arrive by adding text, so the whole string is the assertion.
    expect(rendered).toBe("Nuria Castells" + "Alpha S.L." + "Add another account");
  });
});

describe("the trigger — an avatar and a name", () => {
  it("shows the full name, and no Role line beside it", () => {
    render(<AccountSwitcher account={ALPHA} />);

    const trigger = within(screen.getByTestId("account-switcher"));

    expect(screen.getByTestId("viewer")).toHaveTextContent("Héctor Camps");
    expect(trigger.queryByText("Open default")).toBeNull();
  });

  it("reduces a multi-part name to the initials of its first and last parts", () => {
    render(<AccountSwitcher account={ALPHA} />);

    expect(screen.getByTestId("account-switcher").textContent).toContain("HC");
  });

  it("takes the last part, not the second — half the roster carries two surnames", () => {
    // Ticket 65 seeds nine one-surname and nine two-surname humans, so "first and second" and
    // "first and last" agree on half the Members and disagree on the other half. A three-part
    // name is the only case that tells the two rules apart.
    render(<AccountSwitcher account={{ ...ALPHA, fullName: "Diego Navarro Prieto" }} />);

    expect(screen.getByTestId("account-switcher").textContent).toContain("DP");
  });

  it("falls back to the first two letters when a name has one part", () => {
    render(<AccountSwitcher account={{ ...ALPHA, fullName: "Prometheus" }} />);

    expect(screen.getByTestId("account-switcher").textContent).toContain("Pr");
  });
});

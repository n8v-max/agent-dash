// **Ticket 58 — the switcher's Organization group, which the committed fixture cannot show.**
//
// One Organization is seeded, so `organizationsFor` returns a single entry for every Member and
// the "Switch organisation" group never renders in the running application. That is a deliberate
// consequence of keeping one dataset, not an oversight — but it means the branch has no e2e
// coverage and could rot silently. So the component takes its Organization list as a prop, and
// these tests hand it the two-Organization world the fixture does not contain.
//
// **The T-E4 line is asserted, not assumed.** The menu may carry the viewer's *own* name — R-A3.1
// grants `self` over every class to every Role — and must not carry anybody else's, because the
// other entry names a Member the viewer may hold no identifying scope over. Both halves are
// checked, since a test that only asserted the absence would pass against a menu rendering no
// names at all.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Account } from "@/data/accounts";
import type { Organization } from "@/domain/types";

const ALPHA: Account = {
  memberId: "mem_here",
  orgSlug: "alpha",
  orgName: "Alpha S.L.",
  fullName: "Héctor Vidal",
  roleName: "Open default",
};

const OTHER: Account = {
  memberId: "mem_other",
  orgSlug: "alpha",
  orgName: "Alpha S.L.",
  fullName: "Someone Else Entirely",
  roleName: "Restricted (contractor)",
};

// `signInAccounts` reads the fixture through `loadDataset`; the two accounts are the input to
// this component, not the thing under test, so they are supplied rather than loaded.
vi.mock("@/data/accounts", () => ({ signInAccounts: () => [ALPHA, OTHER] }));

const { AccountSwitcher } = await import("./account-switcher");

const org = (id: string, slug: string, name: string): Organization => ({
  id,
  slug,
  name,
  timezone: "Europe/Madrid",
  github_org: slug,
  window_start: "2026-04-12",
  window_end: "2026-09-08",
  window_days: 150,
});

const ALPHA_ORG = org("org_a", "alpha", "Alpha S.L.");
const GLOBEX_ORG = org("org_b", "globex", "Globex Corp.");

describe("with one Membership — the shipped fixture's shape", () => {
  it("offers no Organization switch", () => {
    render(<AccountSwitcher account={ALPHA} organizations={[ALPHA_ORG]} />);

    expect(screen.queryByTestId("switch-organization")).toBeNull();
    // The positive control: the account group is there, so the absence above means something.
    expect(within(screen.getByTestId("switch-account")).getAllByRole("button")).toHaveLength(2);
  });

  it("names the Organization and the Role on every entry", () => {
    render(<AccountSwitcher account={ALPHA} organizations={[ALPHA_ORG]} />);

    const menu = within(screen.getByTestId("switch-account"));
    expect(menu.getByText("Alpha S.L. · Open default")).toBeDefined();
    expect(menu.getByText("Alpha S.L. · Restricted (contractor)")).toBeDefined();
  });
});

describe("T-E4 — the menu names the viewer, and nobody else", () => {
  it("carries the acting Member's own name and not the other account's", () => {
    render(<AccountSwitcher account={ALPHA} organizations={[ALPHA_ORG]} />);

    const menu = within(screen.getByTestId("switch-account"));
    expect(menu.getAllByText("Héctor Vidal").length).toBeGreaterThan(0);
    expect(menu.queryByText("Someone Else Entirely")).toBeNull();
  });

  it("swaps which name is shown when the other account is the acting one", () => {
    render(<AccountSwitcher account={OTHER} organizations={[ALPHA_ORG]} />);

    const menu = within(screen.getByTestId("switch-account"));
    expect(menu.getAllByText("Someone Else Entirely").length).toBeGreaterThan(0);
    expect(menu.queryByText("Héctor Vidal")).toBeNull();
  });
});

describe("with two Memberships — the world the fixture does not hold", () => {
  it("offers the Organizations the Member holds, minus the one they are in", () => {
    render(<AccountSwitcher account={ALPHA} organizations={[ALPHA_ORG, GLOBEX_ORG]} />);

    const group = within(screen.getByTestId("switch-organization"));
    const buttons = group.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(group.getByText("Globex Corp.")).toBeDefined();
    // The current Organization is not offered as a destination — switching to where you already
    // are is a round trip that reads as a no-op bug.
    expect(group.queryByText("Alpha S.L.")).toBeNull();
  });

  it("posts the acting Member and the target slug, so the endpoint resolves the pairing", () => {
    render(<AccountSwitcher account={ALPHA} organizations={[ALPHA_ORG, GLOBEX_ORG]} />);

    // The pairing is the security-relevant part of this form: `/api/session` re-resolves it
    // against the Member's Memberships, and a slug posted for somebody else's tenant is what
    // ticket 58 exists to stop being mintable.
    const group = within(screen.getByTestId("switch-organization"));
    expect(group.getByDisplayValue("mem_here")).toHaveAttribute("name", "member_id");
    expect(group.getByDisplayValue("globex")).toHaveAttribute("name", "org_slug");
  });
});

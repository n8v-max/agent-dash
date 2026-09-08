import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { signInAccounts } from "@/data/accounts";
import SignInPage from "./page";

// The form's `method` and `action` are asserted end to end instead of here: T-E3 clicks the
// button and checks where the browser lands, which is the claim — a matching attribute pair
// that the server rejects would still pass a DOM assertion.
describe("SignInPage", () => {
  it("offers one 'continue as' button per seeded account (R-A4)", () => {
    render(<SignInPage />);

    expect(screen.getAllByRole("button", { name: /continue as/i })).toHaveLength(2);
  });

  it("names each account and the Role it holds", () => {
    render(<SignInPage />);

    for (const account of signInAccounts()) {
      expect(
        screen.getByRole("button", { name: `Continue as ${account.fullName}` }),
      ).toBeInTheDocument();
      expect(screen.getByText(account.roleName)).toBeInTheDocument();
    }
  });
});

// Ticket 47 — the page is now the landing's second screen. Everything above still holds with
// the selectors it always used; these cover what the redesign added.
describe("SignInPage — as the landing's second screen (ticket 47)", () => {
  it("heads the page 'Continue as', inside a main landmark", () => {
    render(<SignInPage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Continue as");
  });

  it("says in one sentence what each Role reaches, and what it does not", () => {
    // The restricted line has to name the *absence* of cost, or the two cards read as the same
    // account twice. It is copy, so it is asserted as copy — the grants themselves are proved
    // in `src/domain/access.test.ts`.
    render(<SignInPage />);

    expect(
      screen.getByText(/every Member of the Organization by name/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no cost at all/i)).toBeInTheDocument();
  });

  it("offers exactly one link, back to the landing", () => {
    render(<SignInPage />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { restrictedAccount, signInAccounts } from "@/data/accounts";
import SignInPage from "./page";

// The form's `method` and `action` are asserted end to end instead of here: T-E3 clicks the
// button and checks where the browser lands, which is the claim — a matching attribute pair
// that the server rejects would still pass a DOM assertion.
describe("SignInPage — one demo action (R-A4 as amended, ticket 60)", () => {
  it("heads the page 'Sign in', inside a main landmark", () => {
    render(<SignInPage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in");
  });

  it("holds one named form — the demo card — whose one submit signs in to the demo account", () => {
    // The form is the page's only <form>; that count is asserted end to end in smoke.spec.ts,
    // where an unnamed form is countable. Here the form is reached by its landmark name.
    render(<SignInPage />);

    expect(screen.getByRole("form", { name: /demo account/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign in to the demo account" })).toHaveLength(1);
  });

  it("signs in as the one offered account — the open default — read from the fixture", () => {
    const [openDefault] = signInAccounts();
    render(<SignInPage />);

    expect(openDefault).toBeDefined();
    expect(screen.getByDisplayValue(openDefault?.memberId ?? "")).toHaveAttribute(
      "name",
      "member_id",
    );
  });

  it("names that account from the fixture rather than from a literal (ticket 61)", () => {
    // The card used to hardcode "Nuria Castells". Reseeding the Organization would have
    // left the page confidently naming somebody who no longer exists.
    const [openDefault] = signInAccounts();
    render(<SignInPage />);

    expect(openDefault?.fullName).toBeTruthy();
    expect(screen.getByText(new RegExp(`You will be ${openDefault?.fullName ?? ""},`))).toBeInTheDocument();
  });

  it("links the three provider pills to the real sign-in pages, in a new window", () => {
    render(<SignInPage />);

    const expected = [
      ["Continue with Google", "https://accounts.google.com/"],
      ["Continue with Apple", "https://appleid.apple.com/sign-in"],
      ["Continue with GitHub", "https://github.com/login"],
    ] as const;

    for (const [name, href] of expected) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("offers SSO as a disabled button, and says it is not connected", () => {
    render(<SignInPage />);

    const sso = screen.getByRole("button", { name: "Continue with SSO" });

    expect(sso).toBeDisabled();
    expect(sso).toHaveAttribute("type", "button");
    expect(screen.getByText("Single sign-on is not connected in the demo.")).toBeInTheDocument();
  });

  it("does not offer the restricted account, and no longer points anywhere that does", () => {
    // Ticket 61: the contractor is offered nowhere — not here, not in the header switcher. The
    // account is built straight off the fixture, so a reseeded contractor keeps this honest,
    // and the sentence that used to send a reader to the header is asserted gone by its words.
    const restricted = restrictedAccount();
    render(<SignInPage />);

    expect(restricted.fullName).toBeTruthy();
    expect(screen.queryByText(new RegExp(restricted.fullName, "i"))).not.toBeInTheDocument();
    expect(screen.getByRole("main").textContent).not.toMatch(/restricted|contractor|switch/i);
  });

  it("offers four links: the three providers, and Back to the landing", () => {
    render(<SignInPage />);

    const links = screen.getAllByRole("link");

    expect(links).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/");
  });
});

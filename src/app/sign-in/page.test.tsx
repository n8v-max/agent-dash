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

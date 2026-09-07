// R-A4 — two "continue as" buttons, each posting to `POST /api/session`.
//
// Plain `<form method="post">`. No client component, no JavaScript, no fetch: the endpoint
// answers with a 303 and a `Set-Cookie`, which is what a browser does natively. It also means
// the sign-in path is exercised by the e2e suite exactly as a visitor exercises it.

import type { Metadata } from "next";
import { signInAccounts } from "@/data/accounts";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  const accounts = signInAccounts();

  return (
    <main>
      <h1>Continue as</h1>
      <p>
        Two seeded accounts, differing only in the grants their Role holds. Navigation is
        identical for both; the restricted account simply receives fewer rows.
      </p>
      <ul>
        {accounts.map((account) => (
          <li key={account.memberId}>
            <form method="post" action="/api/session">
              <input type="hidden" name="member_id" value={account.memberId} />
              <button type="submit">Continue as {account.fullName}</button>
              <span>{account.roleName}</span>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}

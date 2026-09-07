// R-T15 step 2 — **the authorization boundary.** Every `/[org]/**` route renders inside this
// layout, so there is no authenticated surface it does not sit in front of.
//
// Three outcomes, and the difference between them is the whole tenancy story:
//
//   * no verifiable session  → redirect to `/sign-in`. Nothing has been claimed yet.
//   * unknown slug           → `notFound()`
//   * token org ≠ path org   → `notFound()`
//
// **404, not 403** (R-A7, A11). A 403 says "this Organization exists and is not yours", which
// is the fact a tenancy boundary is there to withhold. The two 404 cases are indistinguishable
// from outside, which is what makes the boundary hold rather than merely be checked.
//
// The shell here is deliberately minimal — ticket 30 owns the real header, toolbar and account
// switcher. What it must already be is **identical for both accounts** (R-A8): the nav below
// is built from one list, with no grant consulted, so no item can be hidden or disabled for
// the restricted account. Fewer rows, never fewer doors.

import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/data/session-cookie";
import { resolveViewer } from "@/data/viewer";

/** R-N1/R-N3: the route axis is the question. Nothing here is grant-dependent (R-A8). */
const NAV = [
  { segment: "", label: "Summary" },
  { segment: "/spend", label: "Spend" },
  { segment: "/work", label: "Work" },
  { segment: "/people", label: "People" },
  { segment: "/history", label: "History" },
  { segment: "/projection", label: "Projection" },
] as const;

export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const resolution = await resolveViewer(token, org);

  if (resolution.outcome === "no-session") redirect("/sign-in");
  if (resolution.outcome === "not-found") notFound();

  return (
    <div>
      <header>
        <Link href={`/${org}`}>agent-dash</Link>
        <nav aria-label="Sections">
          <ul>
            {NAV.map((item) => (
              <li key={item.segment}>
                <Link href={`/${org}${item.segment}`}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        {/*
          The viewer's own name. `self` is granted over every class to every Role (R-A3.1), so
          this is in grant for both accounts and is the one identity on the page that always is.
        */}
        <p data-testid="viewer">{resolution.account.fullName}</p>
      </header>
      <main>{children}</main>
    </div>
  );
}

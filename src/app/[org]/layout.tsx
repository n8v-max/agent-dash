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
// The same three outcomes are taken again in `pageRequest`, because a layout and its page render
// in parallel: the page does not wait for this and cannot read its result.
//
// **The shell is here; the toolbar is not.** R-N3 separates them, and so does this file: the
// header holds *who you are* and is rendered once for every page, while the page toolbar holds
// *what is in the URL* and is rendered by the page, which is the only thing that knows which
// controls it declares.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { SESSION_COOKIE } from "@/data/session-cookie";
import { resolveViewer } from "@/data/viewer";

export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const resolution = await resolveViewer(token, org);

  if (resolution.outcome === "no-session") redirect("/sign-in");
  if (resolution.outcome === "not-found") notFound();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/*
        The viewer's own name rides in the switcher. `self` is granted over every class to every
        Role (R-A3.1), so it is in grant for both accounts and is the one identity on the page
        that always is.
      */}
      <AppHeader orgSlug={org} account={resolution.account} />
      {children}
    </div>
  );
}

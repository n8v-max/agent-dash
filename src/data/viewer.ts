// Boundary 2 in miniature — who is asking, resolved from a token and the fixture.
//
// `src/app/**` may not import `src/domain/**` at runtime (R-T6), so the route layer cannot
// call `roleFor` itself even though the call is one line. That is the point: grants are
// resolved here, from the Member's Role in the fixture, on every request. The token is asked
// only *who* the viewer is (R-T14) and is never asked what they may see.
//
// `queries.ts` (ticket 28) becomes the façade that threads the `Viewer` this returns into
// every query (R-T16). Until it exists this is the only runtime path from a route into the
// domain layer, and it is deliberately the same shape.

import { membershipFromTeams, roleFor, sealViewer, type Viewer } from "@/domain/access";
import { organizationBySlug, toAccount, type Account } from "./accounts";
import { loadDataset, type Dataset } from "./load";
import { readSession } from "./session";

/**
 * What the authoritative layout does next.
 *
 * `not-found` covers an unknown slug, a token for another Organization, and a token naming a
 * Member who is not in it — **one outcome, deliberately**. R-A7: 404, never 403. A 403
 * confirms that an Organization exists, and a resolution that distinguished "wrong org" from
 * "no such org" would hand the caller exactly that confirmation.
 */
export type ViewerResolution =
  | { readonly outcome: "signed-in"; readonly viewer: Viewer; readonly account: Account }
  | { readonly outcome: "no-session" }
  | { readonly outcome: "not-found" };

const NOT_FOUND: ViewerResolution = { outcome: "not-found" };

/**
 * Verifies the token, checks it against the `[org]` path segment, and resolves the Member's
 * grants from the fixture.
 *
 * **Three things have to agree, not two.** The slug in the URL is the tenancy claim a reviewer
 * can see (R-A2), so the token is checked against the *path*; and then the acting Member is
 * resolved **through a Membership in that same Organization**, so the Member is checked too.
 *
 * Ticket 58: the third check did not exist. The lookup was `members.find(id === member_id)`
 * across the whole dataset, so a token minted for Organization A naming a Member of Organization
 * B satisfied both remaining checks and resolved signed-in. It was unreachable only because the
 * fixture held one Organization and a Member carried no Organization at all — which is precisely
 * why nothing caught it, and why the fix is a *lookup* change and not a *predicate* added after
 * one. A Member of another Organization is now unfindable rather than found-then-refused.
 *
 * `dataset` is a parameter so the two-Organization case is expressible in a test without a second
 * Organization in the committed fixture (the `FixtureReader` precedent in `load.ts`). Production
 * never passes it.
 */
export const resolveViewer = async (
  token: string | undefined,
  orgSlug: string,
  dataset: Dataset = loadDataset(),
): Promise<ViewerResolution> => {
  const claims = await readSession(token);
  if (!claims) return { outcome: "no-session" };

  const organization = organizationBySlug(orgSlug, dataset);
  if (!organization || claims.org_slug !== orgSlug) return NOT_FOUND;

  const { members, memberships, teams } = dataset;
  // Org-scoped by construction: the predicate names the Organization the path and the token
  // already agree on, so there is no branch in which an unscoped row could be returned.
  const membership = memberships.find(
    (candidate) =>
      candidate.member_id === claims.member_id &&
      candidate.organization_id === organization.id,
  );
  const member = members.find((candidate) => candidate.id === membership?.member_id);
  // One `NOT_FOUND` for "no such Member" and for "a Member of somewhere else" — R-A7, and the
  // reason the test asserts the two are *indistinguishable* rather than merely both errors.
  if (!membership || !member) return NOT_FOUND;

  const role = roleFor(membership.role);
  const viewer: Viewer = sealViewer({
    memberId: member.id,
    teamIds: membershipFromTeams(teams).get(member.id) ?? [],
    role,
  });
  return { outcome: "signed-in", viewer, account: toAccount(member, organization, role) };
};

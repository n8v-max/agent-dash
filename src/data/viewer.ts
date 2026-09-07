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

import { membershipFromTeams, roleFor, type Viewer } from "@/domain/access";
import { organizationBySlug, toAccount, type Account } from "./accounts";
import { loadDataset } from "./load";
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
 * The org comparison is token-against-*path*, not token-against-dataset: the slug in the URL
 * is the tenancy claim a reviewer can see (R-A2), so it is the one that has to be satisfied.
 */
export const resolveViewer = async (
  token: string | undefined,
  orgSlug: string,
): Promise<ViewerResolution> => {
  const claims = await readSession(token);
  if (!claims) return { outcome: "no-session" };

  const organization = organizationBySlug(orgSlug);
  if (!organization || claims.org_slug !== orgSlug) return NOT_FOUND;

  const { members, teams } = loadDataset();
  const member = members.find((candidate) => candidate.id === claims.member_id);
  if (!member) return NOT_FOUND;

  const role = roleFor(member.role);
  const viewer: Viewer = {
    memberId: member.id,
    teamIds: membershipFromTeams(teams).get(member.id) ?? [],
    role,
  };
  return { outcome: "signed-in", viewer, account: toAccount(member, organization, role) };
};

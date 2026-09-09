// The two seeded accounts (R-A3), read out of the fixture.
//
// Separate from `viewer.ts` because `/sign-in` needs the *list* and not the token machinery:
// this module is what a visitor holding no session reaches, and it must not drag in the
// signing key to render two buttons.

import { SHIPPED_PRESETS, roleFor, type Role } from "@/domain/access";
import type { Member, Organization } from "@/domain/types";
import { loadDataset, type Dataset } from "./load";
import { FixtureFault } from "./schema";

/** One of the two seeded accounts, as `/sign-in` needs to offer it (R-A4). */
export type Account = {
  readonly memberId: string;
  readonly orgSlug: string;
  /**
   * The Organization's display name. Distinct from `orgSlug` on purpose and visibly so —
   * `demo` / "Equilibrio S.L." is R-A1's claim made legible rather than asserted: the slug is
   * an identifier in a URL, not a mode the application is running in.
   */
  readonly orgName: string;
  readonly fullName: string;
  /** The Role's display name. Presentation only — the token never carries it (R-T14). */
  readonly roleName: string;
};

/**
 * Every Organization the fixture carries.
 *
 * **R-A1 — `demo` is an Organization slug, not a demo-mode prefix.** The seeded Organization's
 * slug is `demo` and its name is "Equilibrio S.L.", which is the claim demonstrated rather than
 * asserted: the two are different strings, and every surface renders the name.
 *
 * **What a second Organization actually costs** (ticket 58 — this comment previously said "a
 * fixture change and no code change", and that was false for the sign-in path). Tenancy is now
 * stated in `memberships.json` and enforced in `resolveViewer`, so the code path is genuinely
 * indifferent to how many Organizations exist. What a second one still costs is *data*:
 * `organization.json` holds one row and `load.ts` validates every Membership against it, so
 * admitting a second means pluralising that file and its check, plus a Repository set, a Task set
 * and the full (repository × work_type) session matrix R-D19 requires. Code-shaped work, small;
 * fixture-shaped work, not small. The claim is narrowed to that rather than repeated.
 */
const organizations = (dataset: Dataset = loadDataset()): readonly Organization[] => [
  dataset.organization,
];

export const organizationBySlug = (
  slug: string,
  dataset: Dataset = loadDataset(),
): Organization | undefined =>
  organizations(dataset).find((organization) => organization.slug === slug);

export const toAccount = (member: Member, organization: Organization, role: Role): Account => ({
  memberId: member.id,
  orgSlug: organization.slug,
  orgName: organization.name,
  fullName: member.full_name,
  roleName: role.name,
});

/**
 * The account `/sign-in` offers for one preset: the first seat-holding human whose **Membership
 * in this Organization** resolves to it. Chosen from the data rather than hardcoded, so the two
 * accounts are a property of the fixture and inventing a new Role is not a way to add one.
 *
 * Driven from `memberships` rather than from `members`, which is what makes the Role
 * Organization-scoped: the same person can hold a different Role in a different Organization, and
 * the account offered here is the *pairing*, not the person.
 */
const accountFor = (role: Role, organization: Organization): Account => {
  const { members, memberships } = loadDataset();
  const byId = new Map(members.map((member) => [member.id, member]));
  const membership = memberships.find((candidate) => {
    const member = byId.get(candidate.member_id);
    return (
      candidate.organization_id === organization.id &&
      member?.kind === "human" &&
      member.seat_active &&
      roleFor(candidate.role) === role
    );
  });
  const member = membership && byId.get(membership.member_id);
  if (!member) {
    throw new FixtureFault(
      `memberships.json: no seat-holding human Member holds a Membership in ${organization.id} ` +
        `resolving to the "${role.key}" preset, so R-A3's two accounts cannot both be offered ` +
        "at /sign-in.",
    );
  }
  return toAccount(member, organization, role);
};

/**
 * Every Organization the given Member holds a Membership in — what the account switcher needs to
 * decide whether an Organization switch is offered at all (R-A5).
 *
 * With one Organization seeded this returns at most one entry for anybody, so the switcher's
 * Organization group never renders in the shipped fixture. It is exercised against a hand-built
 * two-Organization `Dataset` in the unit tests, which is the only place the many-to-many is
 * currently observable — stated plainly rather than left for a reader to discover.
 */
export const organizationsFor = (
  memberId: string,
  dataset: Dataset = loadDataset(),
): readonly Organization[] => {
  const held = new Set(
    dataset.memberships
      .filter((membership) => membership.member_id === memberId)
      .map((membership) => membership.organization_id),
  );
  return organizations(dataset).filter((organization) => held.has(organization.id));
};

/** The two accounts of R-A3, in the order `/sign-in` offers them (R-A4). */
export const signInAccounts = (): readonly Account[] => {
  const [organization] = organizations();
  if (!organization) throw new FixtureFault("organization.json: no Organization is seeded.");
  return SHIPPED_PRESETS.map((role) => accountFor(role, organization));
};

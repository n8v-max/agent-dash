// The two seeded accounts (R-A3), read out of the fixture.
//
// Separate from `viewer.ts` because `/sign-in` needs the *list* and not the token machinery:
// this module is what a visitor holding no session reaches, and it must not drag in the
// signing key to render two buttons.

import { SHIPPED_PRESETS, roleFor, type Role } from "@/domain/access";
import type { Member, Organization } from "@/domain/types";
import { loadDataset } from "./load";
import { FixtureFault } from "./schema";

/** One of the two seeded accounts, as `/sign-in` needs to offer it (R-A4). */
export type Account = {
  readonly memberId: string;
  readonly orgSlug: string;
  readonly fullName: string;
  /** The Role's display name. Presentation only — the token never carries it (R-T14). */
  readonly roleName: string;
};

/**
 * Every Organization the fixture carries.
 *
 * **R-A1 — `demo` is an Organization slug, not a demo-mode prefix.** One Organization is
 * seeded; nothing here is written as though one is all there can be. A second Organization is
 * a fixture change and no code change, which is the property R-A1 actually asks for.
 */
const organizations = (): readonly Organization[] => [loadDataset().organization];

export const organizationBySlug = (slug: string): Organization | undefined =>
  organizations().find((organization) => organization.slug === slug);

export const toAccount = (member: Member, organization: Organization, role: Role): Account => ({
  memberId: member.id,
  orgSlug: organization.slug,
  fullName: member.full_name,
  roleName: role.name,
});

/**
 * The account `/sign-in` offers for one preset: the first seat-holding human whose
 * `Member.role` resolves to it. Chosen from the data rather than hardcoded, so the two
 * accounts are a property of the fixture and inventing a new Role is not a way to add one.
 */
const accountFor = (role: Role, organization: Organization): Account => {
  const member = loadDataset().members.find(
    (candidate) =>
      candidate.kind === "human" && candidate.seat_active && roleFor(candidate.role) === role,
  );
  if (!member) {
    throw new FixtureFault(
      `members.json: no seat-holding human Member resolves to the "${role.key}" preset, so ` +
        "R-A3's two accounts cannot both be offered at /sign-in.",
    );
  }
  return toAccount(member, organization, role);
};

/** The two accounts of R-A3, in the order `/sign-in` offers them (R-A4). */
export const signInAccounts = (): readonly Account[] => {
  const [organization] = organizations();
  if (!organization) throw new FixtureFault("organization.json: no Organization is seeded.");
  return SHIPPED_PRESETS.map((role) => accountFor(role, organization));
};

// The authored GitHub → Member join (R-D20). Documented in README.md, applied by the
// generator, and re-applied by the fixture invariant test (T-F8) over the committed JSON —
// which is the only way a reader can check that the rule and the data agree.
//
// The rule, in order:
//   1. Email. The GitHub user's public email, case-folded and trimmed, against the Member's
//      directory email. A `users.noreply.github.com` address is not an email for this
//      purpose — it identifies an account, not a person — and falls through.
//   2. Full name, normalised: accents stripped, case folded, punctuation dropped, internal
//      whitespace collapsed. This is what carries the four users who publish no email.
// No GitHub user may fail to match. An unmatched user is a real product problem that none
// of the six surfaces would show, so it is not modelled.

import type { GithubUser } from "./types.mts";

export type JoinCandidate = { id: string; full_name: string; email: string };

const NOREPLY_SUFFIX = "users.noreply.github.com";

export const normaliseEmail = (email: string | null): string | null => {
  if (email === null) return null;
  const folded = email.trim().toLowerCase();
  if (folded.endsWith(NOREPLY_SUFFIX) || folded.length === 0) return null;
  return folded;
};

export const normaliseName = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export type JoinOutcome =
  | { matched: true; member_id: string; rule: "email" | "full_name" }
  | { matched: false; member_id: null; rule: null };

export const joinGithubUser = (
  user: GithubUser,
  candidates: readonly JoinCandidate[],
): JoinOutcome => {
  const email = normaliseEmail(user.email);
  if (email !== null) {
    const byEmail = candidates.find((candidate) => normaliseEmail(candidate.email) === email);
    if (byEmail !== undefined) return { matched: true, member_id: byEmail.id, rule: "email" };
  }
  const name = normaliseName(user.full_name);
  const byName = candidates.find((candidate) => normaliseName(candidate.full_name) === name);
  if (byName !== undefined) return { matched: true, member_id: byName.id, rule: "full_name" };
  return { matched: false, member_id: null, rule: null };
};

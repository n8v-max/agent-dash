// The 20 Members, their 4 Teams, and the GitHub users they join to. Members and Teams
// imitate the GitHub API (R-T19): GitHub field names, simplified envelope, no pagination.
//
// R-D1 — Spanish Member names, English Team names, and GitHub logins that do not trivially
// match the full names, so the identity join is visibly doing work rather than being an
// equality check on a string the reader can see is the same string.

import { joinGithubUser } from "./join.mts";
import { organization } from "./catalog.mts";
import type { GithubUser, Member, Membership, MemberKind, Team } from "./types.mts";

// [memberId, fullName, emailLocal, kind, role, teamSlugs, githubId, login, githubName, githubEmail]
type PersonRow = readonly [
  string,
  string,
  string,
  MemberKind,
  string,
  readonly string[],
  number,
  string,
  string,
  string | null,
];

const N = null;

const PEOPLE: readonly PersonRow[] = [
  ["mem_ncastells", "Nuria Castells Vidal", "nuria.castells", "human", "member", ["platform"], 8140221, "ncv-dev", "Nuria Castells Vidal", "nuria.castells@equilibrio.io"],
  ["mem_aruiz", "Álvaro Ruiz Ortega", "alvaro.ruiz", "human", "member", ["platform"], 8140237, "aruizo", "ALVARO RUIZ ORTEGA", N],
  ["mem_mpena", "Marta Peña Serrano", "marta.pena", "human", "member", ["platform", "product"], 8140248, "mps-code", "Marta Peña Serrano", "marta.pena@equilibrio.io"],
  ["mem_jdominguez", "Javier Domínguez Lara", "javier.dominguez", "human", "member", ["platform"], 8140259, "jdlara", "Javier Dominguez Lara", "8140259+jdlara@users.noreply.github.com"],
  ["mem_lbermejo", "Lucía Bermejo Ferrer", "lucia.bermejo", "human", "member", ["product"], 8140266, "lubermejo", "Lucía Bermejo Ferrer", "lucia.bermejo@equilibrio.io"],
  ["mem_sibanez", "Sergio Ibáñez Molina", "sergio.ibanez", "human", "member", ["platform", "infrastructure"], 8140274, "sibz", "Sergio Ibanez Molina", N],
  ["mem_ccruz", "Carmen Cruz Delgado", "carmen.cruz", "human", "member", ["product"], 8140283, "ccruzd", "Carmen Cruz Delgado", "carmen.cruz@equilibrio.io"],
  ["mem_pherrera", "Pablo Herrera Gil", "pablo.herrera", "human", "member", ["product"], 8140291, "phgil", "Pablo Herrera Gil", "pablo.herrera@equilibrio.io"],
  ["mem_esaez", "Elena Sáez Roldán", "elena.saez", "human", "member", ["product", "data"], 8140305, "esaez-r", "Elena Saez Roldan", "8140305+esaez-r@users.noreply.github.com"],
  ["mem_dnavarro", "Diego Navarro Prieto", "diego.navarro", "human", "member", ["platform"], 8140318, "dnp-code", "Diego Navarro Prieto", "diego.navarro@equilibrio.io"],
  ["mem_ivazquez", "Irene Vázquez Soto", "irene.vazquez", "human", "member", ["data"], 8140327, "ivsoto", "Irene Vázquez Soto", "irene.vazquez@equilibrio.io"],
  ["mem_rmarin", "Rubén Marín Cano", "ruben.marin", "human", "member", ["data"], 8140336, "rmarinc", "Ruben Marin Cano", N],
  ["mem_blorenzo", "Beatriz Lorenzo Pardo", "beatriz.lorenzo", "human", "member", ["data"], 8140344, "blpardo", "Beatriz Lorenzo Pardo", "beatriz.lorenzo@equilibrio.io"],
  ["mem_aquintana", "Andrés Quintana Rey", "andres.quintana", "human", "member", ["data", "infrastructure"], 8140352, "aqrey", "Andrés Quintana Rey", "andres.quintana@equilibrio.io"],
  ["mem_sroldan", "Silvia Roldán Nieto", "silvia.roldan", "human", "member", ["infrastructure"], 8140361, "sroldann", "Silvia Roldán Nieto", "silvia.roldan@equilibrio.io"],
  ["mem_tferran", "Tomás Ferrán Blasco", "tomas.ferran", "human", "member", ["infrastructure"], 8140379, "tfb-ops", "Tomas Ferran Blasco", N],
  ["mem_ngallego", "Noelia Gallego Ruano", "noelia.gallego", "human", "member", ["product"], 8140388, "ngruano", "Noelia Gallego Ruano", "noelia.gallego@equilibrio.io"],
  ["mem_hcamps", "Héctor Camps Vidal", "hector.camps", "human", "contractor", ["data"], 8140396, "hcv-contract", "Héctor Camps Vidal", "hector.camps@equilibrio.io"],
  ["mem_deploybot", "Equilibrio Deploy Bot", "deploy-bot", "service_account", "automation", ["infrastructure"], 8140402, "equilibrio-deploy-bot", "Equilibrio Deploy Bot", "deploy-bot@equilibrio.io"],
  ["mem_nightlybot", "Equilibrio Nightly Runner", "nightly-runner", "service_account", "automation", ["infrastructure"], 8140417, "equilibrio-nightly", "Equilibrio Nightly Runner", "nightly-runner@equilibrio.io"],
];

const TEAM_ROWS: readonly (readonly [string, string, number])[] = [
  ["platform", "Platform", 4820011],
  ["product", "Product", 4820012],
  ["data", "Data", 4820013],
  ["infrastructure", "Infrastructure", 4820014],
];

// R-A3 — the two shipped accounts. Both are Members of `demo` with real sessions (R-D18).
// The open default is a Platform engineer with ordinary volume and the restricted preset is
// the contractor, whose Team is a strict subset of the Organization — which is what makes
// the two views differ visibly rather than incidentally.
export const OPEN_ACCOUNT_MEMBER_ID = "mem_dnavarro";
export const RESTRICTED_ACCOUNT_MEMBER_ID = "mem_hcamps";

const directoryEmail = (local: string): string => `${local}@equilibrio.io`;

export const githubUsers: GithubUser[] = PEOPLE.map(
  ([, , , , , , githubId, login, githubName, githubEmail]) => ({
    id: githubId,
    login,
    full_name: githubName,
    email: githubEmail,
  }),
);

const candidates = PEOPLE.map(([id, fullName, emailLocal]) => ({
  id,
  full_name: fullName,
  email: directoryEmail(emailLocal),
}));

// The join runs here, not in a comment: every GitHub user is resolved through the documented
// rule, and a user that failed to resolve — or resolved to the wrong Member — stops the build.
export const members: Member[] = PEOPLE.map((person) => {
  const [id, fullName, emailLocal, kind, , teamSlugs, githubId, login] = person;
  const user = githubUsers.find((candidate) => candidate.id === githubId);
  if (user === undefined) throw new Error(`no GitHub user for ${id}`);
  const outcome = joinGithubUser(user, candidates);
  if (!outcome.matched) throw new Error(`R-D20: GitHub user ${login} matched no Member`);
  if (outcome.member_id !== id) {
    throw new Error(`R-D20: GitHub user ${login} matched ${outcome.member_id}, expected ${id}`);
  }
  return {
    id,
    github_id: githubId,
    github_login: login,
    full_name: fullName,
    email: directoryEmail(emailLocal),
    kind,
    team_ids: teamSlugs.map((slug) => `team_${slug}`),
    seat_active: kind === "human",
  };
});

/**
 * The Member↔Organization join, generated from the same `PEOPLE` table the directory is.
 *
 * The Role lives here rather than on the Member because it is a property of the *pairing*
 * (ticket 58). One Organization is seeded, so this is one row per person — the many-to-many is
 * in the shape, not yet in the data.
 */
export const memberships: Membership[] = PEOPLE.map((person) => ({
  organization_id: organization.id,
  member_id: person[0],
  role: person[4],
}));

export const teams: Team[] = TEAM_ROWS.map(([slug, name, githubId]) => ({
  id: `team_${slug}`,
  github_id: githubId,
  slug,
  name,
  member_ids: members.filter((member) => member.team_ids.includes(`team_${slug}`)).map((m) => m.id),
}));

export const memberById = (id: string): Member => {
  const found = members.find((member) => member.id === id);
  if (found === undefined) throw new Error(`unknown member: ${id}`);
  return found;
};

export const humanMembers = members.filter((member) => member.kind === "human");

// Who works on what. Affinity is realism, not a requirement: it stops every Member from
// working every Repository uniformly, which is what a random assignment would produce.
// R-D14 falls out of it — Members belonging to two Teams pull two Repositories, so at least
// one Repository is worked by Members of two or more Teams.

import type { NonReviewWorkTypeKey } from "./allocation.mts";
import type { Member } from "./types.mts";

type RepoWeights = Record<string, number>;

const TEAM_REPOSITORY_WEIGHT: Record<string, RepoWeights> = {
  team_platform: {
    "web-console": 0.34,
    "api-gateway": 0.4,
    "ml-scoring": 0.09,
    "terraform-infra": 0.1,
    "mobile-app": 0.07,
  },
  team_product: {
    "web-console": 0.45,
    "mobile-app": 0.42,
    "api-gateway": 0.07,
    "ml-scoring": 0.03,
    "terraform-infra": 0.03,
  },
  team_data: {
    "ml-scoring": 0.55,
    "api-gateway": 0.18,
    "web-console": 0.14,
    "mobile-app": 0.06,
    "terraform-infra": 0.07,
  },
  team_infrastructure: {
    "terraform-infra": 0.44,
    "api-gateway": 0.3,
    "web-console": 0.11,
    "ml-scoring": 0.1,
    "mobile-app": 0.05,
  },
};

// **`review` is not here, and cannot be** (R-D22, ticket 67). A review is generated from the
// session it reviews rather than chosen for a slot, so the only thing that decides who runs one
// is who was free and on the author's Team (`reviews.mts`). Leaving a review weight in this table
// would have been a number nothing reads — and the type below is what says so.
const TEAM_WORK_TYPE_WEIGHT: Record<string, Partial<Record<NonReviewWorkTypeKey, number>>> = {
  team_platform: { refactor: 1.2 },
  team_product: { implementation: 1.4, bugfix: 1.2 },
  team_data: { refactor: 1.3, implementation: 1.1 },
  team_infrastructure: { deploy: 3 },
};

// R-D13 — the deploy account is a service account running deploys. `mobile-app` is zero
// because mobile releases ship through the app stores (the authored empty pair), so a
// deploy session there could not be placed at all.
const BOT_REPOSITORY_WEIGHT: Record<string, RepoWeights> = {
  mem_deploybot: {
    "terraform-infra": 0.4,
    "api-gateway": 0.3,
    "web-console": 0.2,
    "ml-scoring": 0.1,
    "mobile-app": 0,
  },
};

const BOT_WORK_TYPE_WEIGHT: Record<string, Record<NonReviewWorkTypeKey, number>> = {
  mem_deploybot: {
    deploy: 1,
    implementation: 0.0001,
    bugfix: 0.0001,
    refactor: 0.0001,
  },
  // The nightly runner used to be mostly a reviewer. It cannot be one now — R-D22 wants a human
  // Member of the author's Team looking at the work — so its weight moved to the refactors and
  // fixes a nightly sweep actually lands.
  mem_nightlybot: {
    refactor: 2,
    bugfix: 1,
    implementation: 0.3,
    deploy: 0.05,
  },
};

export const repositoryWeight = (member: Member, repository: string): number => {
  const bot = BOT_REPOSITORY_WEIGHT[member.id];
  if (bot !== undefined) return bot[repository] ?? 0;
  return member.team_ids.reduce(
    (total, teamId) => total + (TEAM_REPOSITORY_WEIGHT[teamId]?.[repository] ?? 0),
    0,
  );
};

export const workTypeWeight = (member: Member, workType: NonReviewWorkTypeKey): number => {
  const bot = BOT_WORK_TYPE_WEIGHT[member.id];
  if (bot !== undefined) return bot[workType];
  return member.team_ids.reduce(
    (total, teamId) => total * (TEAM_WORK_TYPE_WEIGHT[teamId]?.[workType] ?? 1),
    1,
  );
};

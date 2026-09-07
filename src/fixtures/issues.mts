// Tasks are GitHub Issues (CONTEXT.md § Work). They are externally keyed as
// `owner/repo#number`, never synthetic and never absent, because the platform refuses to
// launch an AgentSession without one — which is what makes multi-session analysis
// trustworthy, and what T-F7 checks.
//
// There is no `state` field: the platform does not own the Task's lifecycle, so a resolved
// flag would be a claim the fixture is not entitled to make.

import { GITHUB_ORG, repositoryByName } from "./catalog.mts";
import { intBetween, pick, type Rng } from "./rng.mts";
import { isoInMadrid } from "./schedule.mts";
import type { AssignedTask } from "./assign.mts";
import type { Task, WorkTypeKey } from "./types.mts";

const DAY_MS = 86_400_000;

// Issue numbers start where a repository of this age plausibly sits, and skip: the gaps are
// the issues the platform never ran a session against.
const FIRST_ISSUE_NUMBER: Record<string, number> = {
  "web-console": 312,
  "mobile-app": 187,
  "api-gateway": 455,
  "ml-scoring": 129,
  "terraform-infra": 241,
};

const SUBJECTS: Record<string, readonly string[]> = {
  "web-console": [
    "the saved-view sidebar", "usage table pagination", "the date-range picker",
    "empty states on the spend page", "keyboard navigation in the filter bar",
    "the org switcher", "chart legend truncation", "the export dialog",
    "session detail drawer loading", "the seat usage banner",
  ],
  "mobile-app": [
    "offline session history", "push notification opt-in", "the token usage widget",
    "biometric sign-in", "the pull-to-refresh spinner", "deep links into a job",
    "tablet layout on the summary screen", "the cost tile on Android 16",
    "background refresh throttling", "the onboarding carousel",
  ],
  "api-gateway": [
    "rate limiting on /v2/sessions", "cursor pagination for job listings",
    "the webhook retry queue", "request signing for service accounts",
    "idempotency keys on session launch", "the audit log writer",
    "gzip negotiation", "connection pooling to the metering service",
    "the org-scoped token exchange", "structured error envelopes",
  ],
  "ml-scoring": [
    "the feature backfill job", "batch scoring throughput", "the drift monitor",
    "model artefact versioning", "the training data sampler",
    "embedding cache invalidation", "the evaluation harness",
    "GPU memory pressure in the scorer", "the label export pipeline",
    "scoring latency on cold start",
  ],
  "terraform-infra": [
    "the staging VPC module", "IAM roles for the metering service",
    "the RDS failover drill", "cost allocation tags", "the CDN cache policy",
    "secret rotation for the signing key", "autoscaling on the worker pool",
    "the DNS failover record", "the nightly backup schedule",
    "the bastion host module",
  ],
};

const VERBS: Record<WorkTypeKey, readonly string[]> = {
  implementation: ["Add", "Ship", "Support", "Introduce"],
  bugfix: ["Fix", "Stop the regression in", "Repair"],
  refactor: ["Refactor", "Simplify", "Extract"],
  review: ["Review", "Re-review"],
  deploy: ["Release", "Roll out", "Promote"],
};

const titleFor = (rng: Rng, repository: string, workType: WorkTypeKey): string =>
  `${pick(rng, VERBS[workType])} ${pick(rng, SUBJECTS[repository])}`;

// Returned in the same order as `assigned`, so `tasks[i]` is the Task of `assigned[i]`.
export const mintTasks = (rng: Rng, assigned: readonly AssignedTask[]): Task[] => {
  const tasks: Task[] = new Array<Task>(assigned.length);
  for (const repository of Object.keys(FIRST_ISSUE_NUMBER)) {
    const indices = assigned
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.repository === repository)
      .sort((a, b) => a.task.sessions[0].slot.started_at_ms - b.task.sessions[0].slot.started_at_ms);
    let number = FIRST_ISSUE_NUMBER[repository];
    for (const { task, index } of indices) {
      number += intBetween(rng, 1, 4);
      const openedAt = task.sessions[0].slot.started_at_ms - intBetween(rng, 0, 14) * DAY_MS;
      tasks[index] = {
        key: `${GITHUB_ORG}/${repository}#${number}`,
        number,
        title: titleFor(rng, repository, task.sessions[0].work_type),
        repository_id: repositoryByName(repository).id,
        html_url: `https://github.com/${GITHUB_ORG}/${repository}/issues/${number}`,
        created_at: isoInMadrid(openedAt),
      };
    }
  }
  return tasks;
};

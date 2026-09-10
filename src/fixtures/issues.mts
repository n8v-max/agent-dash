// Tasks are GitHub Issues (CONTEXT.md § Work). They are externally keyed as
// `owner/repo#number`, never synthetic and never absent, because the platform refuses to
// launch an AgentSession without one — which is what makes multi-session analysis
// trustworthy, and what T-F7 checks.
//
// There is no `state` field: the platform does not own the Task's lifecycle, so a resolved
// flag would be a claim the fixture is not entitled to make.

import type { AssignedTask } from "./assign.mts";
import type { NonReviewWorkTypeKey } from "./allocation.mts";
import { GITHUB_ORG, repositoryByName } from "./catalog.mts";
import { check } from "./check.mts";
import { chance, intBetween, pick, type Rng } from "./rng.mts";
import { isoInMadrid } from "./schedule.mts";
import type { Task } from "./types.mts";

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

// **The title vocabulary, and why it is three lists rather than one** (ticket 67; handed over by
// ticket 66, which found a title repeating about forty times on `/demo/history`).
//
// A title is `verb + subject`, optionally narrowed by an aspect or — for a deploy — by where it
// went. Composing rather than enumerating is what buys the variety: sixteen subjects and sixteen
// aspects are thirty-two strings per Repository and 272 subject phrases, where a flat list would
// have needed 272 authored lines to reach the same place. On the committed data no title is worn
// more than a handful of times, and `assertTitles` below makes that a checked property rather
// than an impression.
const SUBJECTS: Record<string, readonly string[]> = {
  "web-console": [
    "the saved-view sidebar", "usage table pagination", "the date-range picker",
    "empty states on the spend page", "keyboard navigation in the filter bar",
    "the org switcher", "chart legend truncation", "the export dialog",
    "session detail drawer loading", "the seat usage banner",
    "the comparison period selector", "the Model mix panel", "the ranked table header",
    "the projection footnote", "the permission matrix page", "the Team overlap notice",
  ],
  "mobile-app": [
    "offline session history", "push notification opt-in", "the token usage widget",
    "biometric sign-in", "the pull-to-refresh spinner", "deep links into a job",
    "tablet layout on the summary screen", "the cost tile on Android 16",
    "background refresh throttling", "the onboarding carousel",
    "the account switcher sheet", "the spend sparkline", "the search field",
    "landscape charts", "the notification centre", "the share-a-job action",
  ],
  "api-gateway": [
    "rate limiting on /v2/sessions", "cursor pagination for job listings",
    "the webhook retry queue", "request signing for service accounts",
    "idempotency keys on session launch", "the audit log writer",
    "gzip negotiation", "connection pooling to the metering service",
    "the org-scoped token exchange", "structured error envelopes",
    "the health probe endpoint", "the bulk export route", "schema versioning",
    "the tenancy resolver", "request tracing headers", "the quota reporter",
  ],
  "ml-scoring": [
    "the feature backfill job", "batch scoring throughput", "the drift monitor",
    "model artefact versioning", "the training data sampler",
    "embedding cache invalidation", "the evaluation harness",
    "GPU memory pressure in the scorer", "the label export pipeline",
    "scoring latency on cold start", "the feature store client",
    "the calibration report", "the shadow scoring path", "the fallback model",
    "the inference batcher", "the annotation queue",
  ],
  "terraform-infra": [
    "the staging VPC module", "IAM roles for the metering service",
    "the RDS failover drill", "cost allocation tags", "the CDN cache policy",
    "secret rotation for the signing key", "autoscaling on the worker pool",
    "the DNS failover record", "the nightly backup schedule",
    "the bastion host module", "the artefact registry policy", "the log retention rule",
    "the private link endpoint", "the runner image pipeline", "the alert routing tree",
    "the disaster recovery plan",
  ],
};

// Aspects attach to the subject, not to the verb, so every one of them reads under all three
// code verbs: *Add* the export dialog's empty state, *Fix* the export dialog's empty state,
// *Simplify* the export dialog's empty state.
const ASPECTS: readonly string[] = [
  "empty state", "loading state", "error handling", "retry path", "keyboard focus",
  "pagination", "input validation", "cache key", "audit trail", "timeout handling",
  "metrics", "feature flag", "fallback path", "concurrency limit", "debug logging",
  "config schema",
];

// A deploy does not have an aspect; it has a destination. Same composition, different tail.
const TARGETS: readonly string[] = [
  "to staging", "to production", "to the canary fleet", "to the EU region",
  "behind a flag", "to 10% of traffic", "to the shared cluster", "to the nightly window",
  "to the pilot Organizations", "after the freeze", "on the new runner image",
  "with the rollback plan attached", "to the read replicas", "ahead of the audit",
];

/** How often a title is left as bare `verb + subject`, with no aspect and no destination. */
const PLAIN_TITLE_SHARE = 0.2;

// There is no `review` row, and there cannot be: a review does not open an issue of its own. It
// is generated from the session it reviews and files against that Job's Task (R-D22), so the
// only WorkTypes that ever name a Task are the four a slot can be assigned.
const VERBS: Record<NonReviewWorkTypeKey, readonly string[]> = {
  implementation: ["Add", "Ship", "Support", "Introduce"],
  bugfix: ["Fix", "Stop the regression in", "Repair"],
  refactor: ["Refactor", "Simplify", "Extract"],
  deploy: ["Release", "Roll out", "Promote", "Deploy"],
};

const titleFor = (rng: Rng, repository: string, workType: NonReviewWorkTypeKey): string => {
  const opening = `${pick(rng, VERBS[workType])} ${pick(rng, SUBJECTS[repository])}`;
  if (chance(rng, PLAIN_TITLE_SHARE)) return opening;
  if (workType === "deploy") return `${opening} ${pick(rng, TARGETS)}`;
  return `${opening}'s ${pick(rng, ASPECTS)}`;
};

/**
 * **A title a reader meets forty times stops naming anything.** Ticket 66 left this: at ten
 * subjects and three verbs per Repository the fixture wore each title out. The composition above
 * fixes it, and this is what stops it from silently coming back — a Repository whose subject list
 * was trimmed, or a verb dropped, would show up here rather than on the history page.
 */
const assertTitles = (tasks: readonly Task[]): void => {
  const worn = new Map<string, number>();
  for (const task of tasks) worn.set(task.title, (worn.get(task.title) ?? 0) + 1);
  const most = Math.max(...worn.values());
  check(most <= 8, `R-D1: one Task title is worn ${most} times; ${worn.size} distinct titles`);
  check(
    worn.size >= tasks.length * 0.6,
    `R-D1: ${worn.size} distinct titles across ${tasks.length} Tasks reads as a template`,
  );
};

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
  assertTitles(tasks);
  return tasks;
};

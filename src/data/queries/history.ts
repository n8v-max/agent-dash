// `/demo/history` — the raw rows under every aggregate (R-N19…R-N22).
//
// **A discriminated result** (ticket 28): `?session=` returns one session expanded (R-N20.1)
// rather than the flat table. The detail rides on every row as well, because the expansion is a
// row-level interaction; the parameter exists so that an expanded row survives a share, which
// is what R-T25 asks of every piece of state.
//
// **R-N20.1 is the only surface in the product carrying either figure.** Per-session Model mix
// is meaningful only here — R-M7 forbids Model as an axis on any aggregate — and the four token
// classes appear elsewhere only as rate-card *columns*, never as volumes.
//
// **R-N22 — hidden sessions appear here as nowhere else: not at all.** Nothing in this module
// filters them: `load.ts` stripped them once, at parse, and there is no option here to opt back
// in (R-M2).
//
// **R-N21 — the Task key is plain text**, `owner/repo#number`. The external tracker is
// imaginary, and a dead link is worse than none, so no href is built.

import { resolvesName, type Viewer } from "@/domain/access";
import { tokenVolume, tokensProcessed } from "@/domain/metrics/adoption";
import { sessionDurationSeconds } from "@/domain/metrics/duration";
import { TOKEN_CLASSES, type AgentSession, type TokenClass } from "@/domain/types";
import {
  tableViewModel,
  type TableCell,
  type TableViewModelOf,
} from "@/domain/viewmodel";
import type { ControlSet } from "../params";
import { pageContext, type PageContext } from "./context";

/** R-N20.1 — one session's four disjoint token class volumes and its Model mix. */
export type SessionDetail = {
  readonly sessionId: string;
  readonly taskKey: string;
  /** `null` where the viewer holds no identifying grant over `tokens` for this session's Member. */
  readonly tokensByClass: Readonly<Record<TokenClass, number>> | null;
  /** The four classes summed. Equal to the class volumes added, by construction. */
  readonly tokensProcessed: number | null;
  /** Per-session Model mix — legal *only* here. `null` under the same grant test. */
  readonly modelMix:
    | readonly { readonly key: string; readonly label: string; readonly value: number }[]
    | null;
};

export type HistoryRow = {
  readonly key: string;
  readonly cells: readonly TableCell[];
  readonly detail: SessionDetail;
};

export type HistoryPageViewModel = {
  readonly orgSlug: string;
  /** R-N20 — client pagination at 50, for readability rather than for performance. */
  readonly pageSize: number;
} & (
  | { readonly surface: "table"; readonly table: TableViewModelOf<HistoryRow> }
  | { readonly surface: "session"; readonly row: HistoryRow }
  | { readonly surface: "withheld"; readonly sessionId: string; readonly message: string }
);

/** R-N20 — client pagination at 50. */
const PAGE_SIZE = 50;

/** R-N19's ten columns, in that order. Started is in the Organization's timezone. */
const COLUMNS = [
  { key: "startedAt", label: "Started", numeric: false, sortable: true },
  { key: "member", label: "Member", numeric: false, sortable: true },
  { key: "workType", label: "Template", numeric: false, sortable: true },
  { key: "repository", label: "Repository", numeric: false, sortable: true },
  { key: "taskKey", label: "Job", numeric: false, sortable: true },
  { key: "executionMode", label: "Mode", numeric: false, sortable: true },
  { key: "accepted", label: "Accepted", numeric: false, sortable: true },
  { key: "duration", label: "Duration (s)", numeric: true, sortable: true },
  { key: "tokens", label: "Tokens", numeric: true, sortable: true },
  { key: "cost", label: "Cost", numeric: true, sortable: true },
] as const;

const grantedOver = (context: PageContext, datapoint: "tokens" | "cost", row: AgentSession) =>
  resolvesName(context.access(datapoint), row.member_id);

const detailOf = (context: PageContext, row: AgentSession): SessionDetail => {
  if (!grantedOver(context, "tokens", row)) {
    return {
      sessionId: row.id,
      taskKey: row.task_key,
      tokensByClass: null,
      tokensProcessed: null,
      modelMix: null,
    };
  }

  const volume = tokenVolume(row.token_usage);
  return {
    sessionId: row.id,
    taskKey: row.task_key,
    tokensByClass: volume.byClass,
    tokensProcessed: volume.processed,
    // Per-session, so the roster is a lookup and never a filter (R-M7).
    modelMix: row.token_usage.map((entry) => ({
      key: entry.model_id,
      label: context.label.model(entry.model_id, "exact"),
      value: tokensProcessed(entry),
    })),
  };
};

const rowFor = (context: PageContext, row: AgentSession): HistoryRow => {
  const detail = detailOf(context, row);
  const cells: readonly TableCell[] = [
    context.label.instant(row.started_at),
    context.label.member(row.member_id),
    context.label.workType(row.work_type),
    context.label.repository(row.repository_id),
    // R-N21 — plain text, `owner/repo#number`. No link is built.
    row.task_key,
    row.execution_mode,
    row.accepted ? "yes" : "no",
    sessionDurationSeconds(row),
    detail.tokensProcessed,
    grantedOver(context, "cost", row) ? row.cost : null,
  ];
  return { key: row.id, cells, detail };
};

/**
 * The rows a viewer may read as rows. A raw session row is an identified reading of one
 * Member's work, so it appears only where a granted **identifying** scope resolves that Member
 * (R-A6): under an aggregated grant the same session is still in every total on every other
 * page, and is not a row here.
 */
const readableRows = (context: PageContext): readonly AgentSession[] =>
  context.view("jobs").rows.filter((row) => resolvesName(context.access("jobs"), row.member_id));

const withheldNote = (context: PageContext, shown: number): string | null => {
  const total = context.view("jobs").rows.length;
  const hidden = total - shown;
  if (hidden === 0) return null;
  return (
    `${hidden} ${hidden === 1 ? "session is" : "sessions are"} counted in this period's totals ` +
    "and not listed: your grants reach them aggregated, so they have no row here."
  );
};

/**
 * **`/demo/history`.** One call; `?session=` switches the surface to R-N20.1's expanded row.
 *
 * R-T16: `viewer` first, and there is no callable form without it.
 */
export function historyPage(viewer: Viewer, params: ControlSet): HistoryPageViewModel {
  const context = pageContext(viewer, params);
  const rows = readableRows(context).map((row) => rowFor(context, row));

  if (params.session !== null) {
    const found = rows.find((row) => row.key === params.session);
    if (!found) {
      return {
        orgSlug: params.orgSlug,
        pageSize: PAGE_SIZE,
        surface: "withheld",
        sessionId: params.session,
        message:
          "No session with that id is listed for you in this period: it is outside the range, " +
          "outside the filters, or reached only by an aggregated grant.",
      };
    }
    return { orgSlug: params.orgSlug, pageSize: PAGE_SIZE, surface: "session", row: found };
  }

  return {
    orgSlug: params.orgSlug,
    pageSize: PAGE_SIZE,
    surface: "table",
    table: tableViewModel({
      columns: [...COLUMNS],
      rows,
      // R-N20 — newest first by default; the sort itself is resolved in the domain layer.
      sort: params.sort,
      note: withheldNote(context, rows.length),
    }),
  };
}

/** The four disjoint classes, in the order the expanded row lists them. */
export const SESSION_TOKEN_CLASSES = TOKEN_CLASSES;

// `/[org]/history` — the raw rows under every aggregate (R-N19…R-N22).
//
// The only page whose period control is a free date range rather than a named period, which is
// why `dateRange` and not `period` is what it declares (R-C1).
//
// **Three surfaces, one query.** `historyPage` returns a discriminated ViewModel: the flat table,
// one session expanded (`?session=`, so an expanded row survives a share, R-T25), or a withheld
// note. The page switches on it and renders; it decides nothing.
//
// **R-N22 — hidden sessions appear here as nowhere else: not at all.** They were stripped at
// parse, and nothing on this route can ask for them back.
//
// **R-N20.2 — and the child sessions appear here as nowhere else either.** Every other surface
// reads a figure with the fan-out already folded into it (R-M19); this is the page that shows the
// rows underneath, so it is the page that shows the tree.

import Link from "next/link";
import { pageRequest } from "@/components/controls/request";
import { SessionChildren, SessionDetailPanel } from "@/components/panels/session-detail";
import { SessionTable } from "@/components/panels/session-table";
import { PageFrame } from "@/components/shell/page-frame";
import { historyPage, type HistoryPageViewModel } from "@/data/queries";

const BACK = "text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground";

/** `?session=` — R-N20.1's row on its own, addressable so that it can be shared. */
function OneSession(props: {
  readonly view: Extract<HistoryPageViewModel, { surface: "session" }>;
}) {
  const { row } = props.view;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border p-6">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Session
        </p>
        {/* R-N21 — plain text, `owner/repo#number`. The tracker is imaginary; no link is built. */}
        <p className="mt-1 font-mono text-lg text-foreground">{row.detail.taskKey}</p>
        <div className="mt-6 space-y-6">
          <SessionDetailPanel detail={row.detail} />
          {/* R-N20.2 — the agents that worked this attempt, already inside its figures. */}
          <SessionChildren rows={row.children} />
        </div>
      </div>
      <Link href={`/${props.view.orgSlug}/history`} className={BACK}>
        ← All sessions
      </Link>
    </div>
  );
}

export default async function HistoryPage(props: PageProps<"/[org]/history">) {
  const { org } = await props.params;
  const request = await pageRequest("history", org, await props.searchParams);
  const view = historyPage(request.viewer, request.controls);

  return (
    <PageFrame
      request={request}
      title="History"
      lede="One row per session — one attempt, whatever it cost and however many agents worked it. Expand a row for its four token classes, its Model mix and the sub-agents it fanned out to, all three of which appear here and nowhere else. Hidden sessions appear here as nowhere else: not at all."
    >
      {view.surface === "table" ? (
        <SessionTable
          table={view.table}
          pageSize={view.pageSize}
          caption="Agent sessions, newest first"
        />
      ) : null}
      {view.surface === "session" ? <OneSession view={view} /> : null}
      {view.surface === "withheld" ? (
        <div className="space-y-6">
          <p className="max-w-2xl text-sm text-muted-foreground">{view.message}</p>
          <Link href={`/${view.orgSlug}/history`} className={BACK}>
            ← All sessions
          </Link>
        </div>
      ) : null}
    </PageFrame>
  );
}

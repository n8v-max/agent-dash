// `/[org]/history` — the raw rows under every aggregate (R-N19…R-N22).
//
// The only page whose period control is a free date range rather than a named period, which is
// why `dateRange` and not `period` is what it declares (R-C1).

import { pageRequest } from "@/components/controls/request";
import { DataTable } from "@/components/panels/data-table";
import { PageFrame } from "@/components/shell/page-frame";
import { historyPage } from "@/data/queries";

export default async function HistoryPage(props: PageProps<"/[org]/history">) {
  const { org } = await props.params;
  const request = await pageRequest("history", org, await props.searchParams);
  const view = historyPage(request.viewer, request.controls);

  return (
    <PageFrame
      request={request}
      title="History"
      lede="One row per session. Hidden sessions appear here as nowhere else: not at all."
    >
      {view.surface === "table" ? (
        <DataTable table={view.table} caption="Agent sessions, newest first" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {view.surface === "withheld" ? view.message : `Session ${view.row.key}`}
        </p>
      )}
    </PageFrame>
  );
}

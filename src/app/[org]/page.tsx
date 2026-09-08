// `/[org]` — **the summary** (R-N4…R-N8). Four tiles, nothing below them.
//
// Month-locked (R-N6): the page declares the period control and nothing else, so the toolbar
// carries one control (R-C1) and no grain, no subject and no filter is reachable here. `quarter`
// was dropped in `spec.md` § 11 C7 and has no representation anywhere to reach for.
//
// One call, four tiles: `summaryPage` is the sole runtime path into the domain layer (R-T6), and
// what comes back is fully resolved — the figures, the change floor (R-M12), the five WorkType
// series, the palette, the stack decision (R-V1) and the R-X1 mirror. This file threads a
// `Viewer` into it and hands the result to a component that renders it.

import { SummaryTiles } from "@/components/panels/summary-tiles";
import { pageRequest } from "@/components/controls/request";
import { PageFrame } from "@/components/shell/page-frame";
import { summaryPage } from "@/data/queries";

export default async function OrgSummaryPage(props: PageProps<"/[org]">) {
  const { org } = await props.params;
  const request = await pageRequest("summary", org, await props.searchParams);
  const summary = summaryPage(request.viewer, request.controls);

  return (
    <PageFrame
      request={request}
      title="Summary"
      // R-N1 — the route axis is the question. The four clauses are the four tiles, in order.
      lede="What the month cost, what it produced, the rate that joins the two, and the kind of work behind it."
    >
      <SummaryTiles tiles={summary.tiles} period={summary.period} />
    </PageFrame>
  );
}

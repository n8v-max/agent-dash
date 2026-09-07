// `/[org]/projection` — where the current month lands (R-N23…R-N25).
//
// **It declares no controls, so it has no toolbar at all** (R-N3, R-C1). `PageToolbar` returns
// `null` for a page whose declared set is empty, so the page sits directly under the header —
// absent, not an empty bar.

import { PendingPanels } from "@/components/panels/pending-panels";
import { pageRequest } from "@/components/controls/request";
import { PageFrame } from "@/components/shell/page-frame";

const PANELS = [
  "Spend to date this month",
  "Projected month-end spend, extrapolated from the share elapsed",
  "Actual spend by day within the month",
];

export default async function ProjectionPage(props: PageProps<"/[org]/projection">) {
  const { org } = await props.params;
  const request = await pageRequest("projection", org, await props.searchParams);

  return (
    <PageFrame
      request={request}
      title="Projection"
      lede="The current month, extrapolated in proportion to the period elapsed. No confidence band."
    >
      <PendingPanels panels={PANELS} />
    </PageFrame>
  );
}

// `/[org]` — the summary (R-N4…R-N8). Month-locked; the period control is the only one it
// declares, so the toolbar carries one control and nothing else (R-C1).

import { PendingPanels } from "@/components/panels/pending-panels";
import { pageRequest } from "@/components/controls/request";
import { PageFrame } from "@/components/shell/page-frame";

const PANELS = [
  "Total spend",
  "Completed Jobs",
  "Cost per completed Job",
  "Completed Jobs by template",
];

export default async function OrgSummaryPage(props: PageProps<"/[org]">) {
  const { org } = await props.params;
  const request = await pageRequest("summary", org, await props.searchParams);

  return (
    <PageFrame
      request={request}
      title="Summary"
      lede="Four tiles, each a link to the page carrying its evidence."
    >
      <PendingPanels panels={PANELS} />
    </PageFrame>
  );
}

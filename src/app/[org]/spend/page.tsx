// `/[org]/spend` — what we spend, and what we get for it (R-N9, R-N10).

import { PendingPanels } from "@/components/panels/pending-panels";
import { pageRequest } from "@/components/controls/request";
import { PageFrame } from "@/components/shell/page-frame";

const PANELS = [
  "Cost per completed Job over time",
  "Total spend, split into session cost and seat cost",
  "Cost per session, with the accepted filter",
  "Cost per completed Job by template",
  "Cost by Repository",
  "Adoption: tokens processed over time",
  "Adoption: Model mix at exact / family / tier",
];

export default async function SpendPage(props: PageProps<"/[org]/spend">) {
  const { org } = await props.params;
  const request = await pageRequest("spend", org, await props.searchParams);

  return (
    <PageFrame
      request={request}
      title="Spend"
      lede="The ratio first: cost per completed Job is the figure the total cannot give you."
    >
      <PendingPanels panels={PANELS} />
    </PageFrame>
  );
}

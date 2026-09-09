// `/[org]/projection` — where the current month lands (R-N23…R-N25).
//
// **It declares no controls, so it has no toolbar at all** (R-N3, R-C1). `PageToolbar` returns
// `null` for a page whose declared set is empty, so the page sits directly under the header —
// absent, not an empty bar.
//
// **R-N25 — nothing else in the product depends on this page.** It is reached from the header's
// nav, at secondary weight (R-N2), and links nowhere further; the projection is deliberately kept
// off `/demo` and `/demo/spend`, because moving a forecast off the core surfaces is the mitigation
// ticket 07 chose over dressing it up.

import { pageRequest } from "@/components/controls/request";
import { ProjectionPanel } from "@/components/panels/projection-panel";
import { PageFrame } from "@/components/shell/page-frame";
import { projectionPage } from "@/data/queries";

export default async function ProjectionPage(props: PageProps<"/[org]/projection">) {
  const { org } = await props.params;
  const request = await pageRequest("projection", org, await props.searchParams);
  const view = projectionPage(request.viewer, request.controls);

  return (
    <PageFrame
      request={request}
      title="Projection"
      lede="The current month, extrapolated in proportion to the period elapsed. No confidence band."
    >
      <ProjectionPanel view={view} />
    </PageFrame>
  );
}

// `/[org]/work` — whether the agents are working (R-N12…R-N14).
//
// **One query, six panels** (R-T16). `workPage()` loads, permission-filters and buckets once, and
// returns one fully resolved ViewModel per panel; this module hands that to `WorkPanels` and does
// nothing else. There is no computation here and nothing in scope to compute with — `src/app/**`
// may import `src/domain` for types only, and `src/data/queries.ts` is the sole runtime path.
//
// **The controls this page declares are period and grain · subject · Repository · WorkType ·
// `execution_mode` · per-capita** (R-C1), and they are declared in `params.ts` rather than here,
// so the toolbar cannot show one the panels do not use. `execution_mode` earns its place beyond
// panel 6 (R-C2): it is the one control that separates unattended runs from supervised ones
// across duration and acceptance, and the session model makes it deliberately independent of
// `Member.kind` — an independence that is invisible unless a viewer can filter on both.
//
// **R-C6 — two of the seven are panel-local, and this is where they are placed.** Per-capita
// divides the velocity panel and nothing else on this page. `execution_mode` stands on the two
// panels R-C2 names it for — acceptance and duration — one node each, both bound to
// `?execution_mode=`, so the two headers carry the same links and the URL is the one the toolbar
// used to write.

import { PanelControl } from "@/components/controls/panel-control";
import { pageRequest } from "@/components/controls/request";
import { WorkPanels } from "@/components/panels/work-page-panels";
import { PageFrame } from "@/components/shell/page-frame";
import { workPage } from "@/data/queries";

export default async function WorkPage(props: PageProps<"/[org]/work">) {
  const { org } = await props.params;
  const request = await pageRequest("work", org, await props.searchParams);
  const view = workPage(request.viewer, request.controls);
  const control = (key: "perCapita" | "executionMode") => (
    <PanelControl context={request} control={key} />
  );

  return (
    <PageFrame
      request={request}
      title="Work"
      lede="Velocity, acceptance and duration — period over period, never against a pre-agent baseline."
    >
      <WorkPanels
        view={view}
        controls={{ perCapita: control("perCapita"), executionMode: control("executionMode") }}
      />
    </PageFrame>
  );
}

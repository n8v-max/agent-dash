// `/[org]/spend` — what we spend, and what we get for it (R-N9, R-N10, R-N11).
//
// **One query, seven panels and the rate card** (R-T16, R-T17): `spendPage` is the page's only
// runtime path into the domain layer, and what it returns is fully resolved. Nothing below this
// line filters, buckets, sums, sorts or compares (R-T6).
//
// **The order is R-N9's and the opener is R-N10's**: the ratio first, Total spend second. The
// total has already been read on the summary; the ratio is the differentiator.
//
// **The rate card is last** (R-N11) — collapsed, labelled "illustrative rates", and outside the
// Adoption section, because rates are prices and the Adoption section carries no money (R-M9).
//
// **R-C6 — three of this page's eight declared controls are panel-local, and this is where they
// are placed.** The page knows which panel reads which control; the panels do not, and the
// toolbar no longer holds them. `accepted` narrows Cost per session. Per-capita divides Total
// spend and Cost by Repository — one node, handed to both, bound to `?per_capita=`. The Model
// roll-up redraws the Model mix chart inside the Adoption section, which is the scope R-C1 always
// gave it. Nothing about the query string changes: `PanelControl` renders the same widget from
// the same `ControlSet` the bar rendered it from.

import { PanelControl } from "@/components/controls/panel-control";
import { pageRequest } from "@/components/controls/request";
import { AdoptionSection } from "@/components/panels/adoption-section";
import { RateCard } from "@/components/panels/rate-card";
import { SpendPanels } from "@/components/panels/spend-panels";
import { PageFrame } from "@/components/shell/page-frame";
import { spendPage } from "@/data/queries";

export default async function SpendPage(props: PageProps<"/[org]/spend">) {
  const { org } = await props.params;
  const request = await pageRequest("spend", org, await props.searchParams);
  const page = spendPage(request.viewer, request.controls);
  const control = (key: "accepted" | "perCapita" | "modelLevel") => (
    <PanelControl context={request} control={key} />
  );

  return (
    <PageFrame
      request={request}
      title="Spend"
      lede="The ratio first: cost per completed Job is the figure the total cannot give you."
    >
      <div className="space-y-6">
        <SpendPanels
          page={page}
          controls={{ accepted: control("accepted"), perCapita: control("perCapita") }}
        />
        <AdoptionSection adoption={page.adoption} modelLevelControl={control("modelLevel")} />
        <RateCard card={page.adoption.rateCard} />
      </div>
    </PageFrame>
  );
}

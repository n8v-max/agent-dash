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

  return (
    <PageFrame
      request={request}
      title="Spend"
      lede="The ratio first: cost per completed Job is the figure the total cannot give you."
    >
      <div className="space-y-6">
        <SpendPanels page={page} />
        <AdoptionSection adoption={page.adoption} />
        <RateCard card={page.adoption.rateCard} />
      </div>
    </PageFrame>
  );
}

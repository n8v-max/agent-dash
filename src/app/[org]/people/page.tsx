// `/[org]/people` — who, and how they compare (R-N15…R-N18).
//
// The table renders here because it is what makes the account switch legible: the same path,
// the same controls, fewer rows (R-A5, T-E6). The profile surface and the permission matrix are
// panel-wave work; both arms of the ViewModel are already resolved and are named below rather
// than silently dropped.

import { pageRequest } from "@/components/controls/request";
import { DataTable } from "@/components/panels/data-table";
import { PageFrame } from "@/components/shell/page-frame";
import { peoplePage } from "@/data/queries";

export default async function PeoplePage(props: PageProps<"/[org]/people">) {
  const { org } = await props.params;
  const request = await pageRequest("people", org, await props.searchParams);
  const view = peoplePage(request.viewer, request.controls);

  return (
    <PageFrame
      request={request}
      title="People"
      lede="Ordered by output, never by spend. Every numeric column sorts from the toolbar."
    >
      {view.surface === "table" ? (
        <DataTable table={view.table} caption="Members, with their Jobs, tokens and cost" />
      ) : (
        <p className="text-sm text-muted-foreground">
          {view.surface === "withheld" ? view.message : `Profile for ${view.profile.name}`}
        </p>
      )}
    </PageFrame>
  );
}

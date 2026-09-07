// `/[org]/work` — whether the agents are working (R-N12…R-N14).

import { PendingPanels } from "@/components/panels/pending-panels";
import { pageRequest } from "@/components/controls/request";
import { PageFrame } from "@/components/shell/page-frame";

const PANELS = [
  "Completed Jobs per period, raw or per-capita",
  "Acceptance rate as small multiples, one chart per template",
  "Rework rate and decomposition rate",
  "Incomplete Jobs by age bucket",
  "Session duration, median and p95",
  "Human-presence spans, interactive sessions only",
];

export default async function WorkPage(props: PageProps<"/[org]/work">) {
  const { org } = await props.params;
  const request = await pageRequest("work", org, await props.searchParams);

  return (
    <PageFrame
      request={request}
      title="Work"
      lede="Velocity, acceptance and duration — period over period, never against a pre-agent baseline."
    >
      <PendingPanels panels={PANELS} />
    </PageFrame>
  );
}

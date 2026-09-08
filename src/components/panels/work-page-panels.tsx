// **R-N12 — the six panels of `/[org]/work`, in this order and in one column.**
//
//   1. Completed Jobs per period — raw or per-capita
//   2. Acceptance rate as small multiples, one chart per template on a shared axis
//   3. Rework rate and Decomposition rate, two lines on one chart
//   4. Incomplete Jobs as a horizontal bar by age bucket
//   5. Session duration — median and p95
//   6. Human presence and machine time, `interactive` sessions only
//
// **The order is a requirement, so it is a list here and not a layout.** One column, six panels,
// read top to bottom: a two-column grid would make "the order" mean two different things
// depending on the viewport, and the page's argument runs in one direction — *is work coming
// out*, then *is it accepted*, then *is it being redone*, then *what is stuck*, then *how long
// it takes*, then *how much of that time a human was present for*.
//
// It takes the whole `WorkPageViewModel` because that is what one call to `workPage()` returns
// (R-T16): one load, one permission filter, one bucketing, six projections of the same rows.

import type { WorkPageViewModel } from "@/data/queries";
import { AcceptanceMultiples } from "./work-acceptance";
import { PresenceSpans } from "./work-presence";
import {
  DurationChart,
  IncompleteAgesChart,
  TaskRatesChart,
  VelocityChart,
} from "./work-panels";

export function WorkPanels(props: { readonly view: WorkPageViewModel }) {
  const { view } = props;

  return (
    <div className="space-y-6">
      <VelocityChart panel={view.velocity} />
      <AcceptanceMultiples panels={view.acceptance} axis={view.acceptanceAxis} />
      <TaskRatesChart panel={view.taskRates} />
      <IncompleteAgesChart panel={view.incompleteAges} />
      <DurationChart panel={view.duration} />
      <PresenceSpans panel={view.presenceSpans} />
    </div>
  );
}

// **R-C6 — a panel-local control, in the header of the panel that reads it.**
//
// Four toggles used to stand in the page toolbar and change one panel out of seven. A bar reads
// as a page-wide claim; `accepted` narrows Cost per session and nothing else, the Model roll-up
// redraws one chart inside the Adoption section, and per-capita divides two money panels and
// leaves the three ratios beside them untouched. Standing them beside the figures they move is
// what makes their reach visible without a caption.
//
// **The parameter does not move — only the node does.** This renders the same `ControlWidget`
// the toolbar renders, from the same `ControlSet`, through the same `controlHref`: the `href` a
// per-capita toggle carries in the Total spend header is character-for-character the one it
// carried in the bar. That is the whole of the constraint the ticket put on this change, and
// T-C14 asserts it as an equality rather than trusting it.
//
// **A control this page does not declare renders nothing** (R-C1). The guard is not defensive
// dressing: it is what stops a panel that appears on two pages carrying a control only one of
// them has — `/demo/spend` declares per-capita and `/demo/people` does not, and a panel does not
// know which page it is on.
//
// A control reaching two panels is rendered twice, from one parameter. Two nodes, one state:
// both read `props.controls`, so they cannot disagree, and following either writes the same URL.

import type { ControlKey } from "@/data/params";
import { ControlWidget, type ControlContext } from "./control-renderers";
import { declaredControls } from "./schema";

/**
 * The header slot. Sized down from the toolbar's own metrics — a panel-local control is
 * subordinate to the heading it sits beside, and reading as another page-wide filter is the one
 * thing it must not do.
 */
export function PanelControl(props: {
  readonly context: ControlContext;
  readonly control: ControlKey;
}) {
  if (!declaredControls(props.context.controls.page).includes(props.control)) return null;

  return (
    <div data-testid="panel-control" className="ml-auto shrink-0">
      <ControlWidget control={props.control} {...props.context} />
    </div>
  );
}

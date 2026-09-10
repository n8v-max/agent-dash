*Built as ticket 60.*

# Landing drafts

**Build ticket:** [`60-landing-v2.md`](../../.scratch/agent-dash/issues/60-landing-v2.md), specified for an AFK run against `img/picture-v2.png`.

Two proposed shapes for `/` and its second screen, and the brief they rest on. Opened by
[ticket 59](../../.scratch/agent-dash/issues/59-landing-reshape.md) on 2026-09-10, against the
current landing (ticket 37, `src/app/page.tsx`), which reads as one line and one link and shows no
path into the product's value before the click.

| File | What it is |
|---|---|
| [`shape-a-two-readers.md`](shape-a-two-readers.md) | One page, two columns: engineering leadership (cost control, cost evaluation, who runs agents well) and the individual contributor (find the people to learn from). Two entry points, one per reader. |
| [`shape-b-swarm-and-organisation.md`](shape-b-swarm-and-organisation.md) | The page opens on the swarm, not the dashboard: the four situations in which cloud agents pay, each paired with the figure that tests it, when they do not pay, and what the product refuses to claim. |
| [`shape-c-vp-jobs.md`](shape-c-vp-jobs.md) | **Current direction (2026-09-10).** The VP of Engineering's jobs from first principles, seven value points stack-ranked with fixture evidence, folded into four cards with chart illustrations. Rendered at [`img/shape-c-cards.png`](img/shape-c-cards.png). |
| [`img/picture-v2.png`](img/picture-v2.png) | **Current picture (2026-09-10).** The lean version: slogan, paragraph, one link, four text blocks with one figure each. No charts. Source in [`img/picture-v2.html`](img/picture-v2.html). |
| [`picture-v1.md`](picture-v1.md) | **The picture to iterate on.** Editorial ledger direction, the design system, the eleven elements element by element, what is true and what is placeholder. Rendered at [`img/picture-v1.png`](img/picture-v1.png). |
| [`competitors.md`](competitors.md) | Who actually competes (native platform analytics vs the measurement layer), the top three on positioning and reviews with Zencoder first, what to steal from each, and the five edits it implies for Shape C. |
| [`value-proposition-brief.md`](value-proposition-brief.md) | Why a cloud swarm is worth anything to an engineering organisation, how honestly the ROI-against-local question can be answered, and the two readers' goals mapped to surfaces that exist and gaps that do not. |

**Both shapes share:** a thirty-second path with real fixture figures on the landing itself; a
rewritten `/sign-in` heading; no word the smoke test forbids; and the refused productivity claim
kept.

**Both shapes change:** the `<h1>` asserted in `src/app/page.test.tsx` and `e2e/smoke.spec.ts`, and
the row in `docs/positioning.md` that holds the one-liner to the hero. Shape A also changes R-N1's
single-link rule and touches the *"not a performance review tool"* line. Each file's closing section
lists what it disturbs.

**Status of A and B.** Both were read by the human on 2026-09-10 and set aside: they led with
actors or with the platform rather than with the decision maker's jobs, and they gave the
individual contributor a primary position that belongs to a side effect. They stay for the copy
blocks and the held-to tables, which Shape C reuses. Shape C is the direction.

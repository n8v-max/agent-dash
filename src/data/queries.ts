// **The façade.** The one runtime path from a route into the domain layer (R-T6, R-T33).
//
// `src/app/**` and `src/components/**` may import `src/domain` for **types only** — the ESLint
// rule `agent-dash/rendering-layer-cannot-compute` allows nothing else. So this module is where
// a Server Component's call lands, and what it gets back is a fully resolved, serialisable
// ViewModel: a panel receives it and renders it, and has nothing in scope to compute with.
//
// **Six functions, one per route in R-N1** — not one per panel. The design pass on ticket 28
// settled it: twenty per-panel entry points would be a shallow interface, and each would
// independently load, filter and bucket, so seven panels on one page could disagree about the
// population or the bucket edges. One call per page means the load, the permission filter
// (R-T17) and the bucketing happen once, and the page ViewModel holds one fully-resolved panel
// ViewModel per panel.
//
// **R-T16 is enforced by the type.** Every function here takes a `Viewer` first, and a `Viewer`
// is producible only by `resolveViewer`, which verifies the JWT. An unfiltered query does not
// typecheck, because there is no expression that names one.
//
// The page modules live under `queries/` because this file's own budget is 300 lines and one of
// them alone would spend it; they are re-exported here so the façade is still one import.

export { summaryPage } from "./queries/summary";
export { spendPage } from "./queries/spend";
export { workPage } from "./queries/work";
export { peoplePage } from "./queries/people";
export { historyPage } from "./queries/history";
export { projectionPage } from "./queries/projection";
// The toolbar's own ViewModel (R-C1, ticket 30). Seventh entry point, same shape as the six:
// a `Viewer` first, a `ControlSet` second, and a fully-resolved structure back.
export { controlOptions, PEOPLE_SORT_COLUMNS } from "./queries/controls";

export type { SummaryPageViewModel, SummaryTile } from "./queries/summary";
export type {
  CostPerSessionPanel,
  SpendPageViewModel,
  TotalSpendPanel,
} from "./queries/spend";
export type {
  AdoptionSection,
  DistributionViewModel,
  ModelMixPanel,
  RateCardViewModel,
} from "./queries/adoption";
export type {
  AcceptancePanel,
  TaskRatesPanel,
  VelocityPanel,
  WorkPageViewModel,
} from "./queries/work";
export type {
  DurationPanel,
  IncompleteAgesPanel,
  PresenceSpansPanel,
} from "./queries/work-panels";
export type { PeoplePageViewModel } from "./queries/people";
export type {
  ComparatorBar,
  ComparatorViewModel,
  ComparisonGroup,
  MemberProfileViewModel,
} from "./queries/profile";
export type { HistoryPageViewModel, HistoryRow, SessionDetail } from "./queries/history";
export type { ProjectionComponents, ProjectionPageViewModel } from "./queries/projection";
export type { ControlOption, ControlOptions } from "./queries/controls";

// **R-N16 — `?member=` replaces the list with that Member's profile**: the four headline tiles
// at their scope, their WorkType mix, and the comparator (R-N17).
//
// The profile is a *surface*, not a panel hidden inside the table: the ViewModel arrived as a
// discriminated union and this component renders one arm of it. Nothing on this page is a
// filtered table.
//
// **R-M15 — ranking exists but is never editorialised.** There is no percentile label here, no
// rank, no "top spender" heading and no badge. The Member's figures sit beside their comparison
// group's median (R-N17) and the reader draws the conclusion. That is the whole position the
// product takes against `KiroRank`: ordering is available, and the product declines to publish
// one as a headline.
//
// **The WorkType mix goes through `ChartFrame`** (R-T28), which supplies the `aria-label` naming
// the roll-up level (R-X2), the R-X1 mirror and the R-V9 empty state. WorkType is one of the
// groupings R-V1 permits to assert a partition, so the ViewModel's own `stackable` decides the
// geometry and this component does not.
//
// **It computes nothing** (R-T6): four tiles, a chart and three pairs of numbers, all resolved.

import Link from "next/link";
import { ChartFrame } from "@/components/charts/chart-frame";
import type { MemberProfileViewModel } from "@/data/queries";
import type { TileViewModel } from "@/domain/viewmodel";
import { ComparatorPanel } from "./comparator-bars";
import { changeCaption, formatFigure } from "./figures";

/** R-E2 — a period clipped by the range or unfinished as of `now` is flagged, never withheld. */
const PARTIAL_TEXT = "partial period";

export const BACK_TEXT = "All Members";

/** The four headline figures, named as a group so a reader reaches them as one thing. */
export const TILES_LABEL = "Headline figures";

/** One headline figure at this Member's scope, with R-N7's period-over-period change. */
function ProfileTile(props: { readonly tile: TileViewModel }) {
  const { tile } = props;

  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {tile.title}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {formatFigure(tile.value, tile.unit)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {tile.period.label}
        {tile.period.partial ? ` · ${PARTIAL_TEXT}` : ""}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {tile.caption ?? changeCaption(tile.change)}
      </p>
    </div>
  );
}

/** Who this is: the name, the kind, the Teams, and the way back to the list. */
function ProfileHeader(props: {
  readonly profile: MemberProfileViewModel;
  readonly backHref: string;
}) {
  const { profile } = props;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{profile.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.kind === "service_account" ? "Service account" : "Human"}
          {profile.teams.length > 0 ? ` · ${profile.teams.join(", ")}` : ""}
        </p>
      </div>
      <Link
        href={props.backHref}
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← {BACK_TEXT}
      </Link>
    </div>
  );
}

export function MemberProfile(props: {
  readonly profile: MemberProfileViewModel;
  /** The same page with `?member=` dropped — R-C4's canonical short form of the list surface. */
  readonly backHref: string;
}) {
  const { profile } = props;

  return (
    <div className="space-y-6">
      <ProfileHeader profile={profile} backHref={props.backHref} />

      <div
        role="group"
        aria-label={TILES_LABEL}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {profile.tiles.map((tile) => (
          <ProfileTile key={tile.key} tile={tile} />
        ))}
      </div>

      <section
        aria-label={profile.workTypeMix.title}
        // shadcn's vendored `ChartContainer` hard-codes `aspect-video`, which at desktop width
        // makes a six-bucket bar chart 800px tall and pushes the comparator below the fold. The
        // ratio is re-set from *this* wrapper rather than by editing the vendored primitive
        // (`src/components/ui/**` is not authored here) or by giving `ChartFrame` a fixed height,
        // which R-T29 reserves for tests.
        className="rounded-xl border border-border p-5 [&_[data-slot=chart]]:aspect-[16/5]"
      >
        <h2 className="mb-3 text-sm font-semibold tracking-tight text-foreground">
          {profile.workTypeMix.title}
        </h2>
        <ChartFrame chart={profile.workTypeMix} shape="bar" />
      </section>

      <ComparatorPanel comparator={profile.comparator} memberName={profile.name} />
    </div>
  );
}

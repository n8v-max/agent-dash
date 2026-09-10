// `/[org]/people` — who, and how they compare (R-N15…R-N18, R-A9, R-A10).
//
// **One query, three surfaces.** `peoplePage` returns a discriminated ViewModel and this page
// renders the arm it was given: the table, one Member's profile (`?member=`, R-N16), or the
// withheld notice for a Member this viewer does not resolve by name (R-A6). The profile is not a
// panel hidden inside the table and the withheld arm is not an empty table — a surface is a
// property of the params, decided upstream.
//
// **What the restricted account sees here is different in kind, not just shorter.** It holds no
// scope resolving another Member by name, so its rows are not a filtered version of the open
// account's twenty: it gets **its own row and nothing else** (C10). One row is the whole table.
//
// **The visibility line, not a permission matrix** (R-A10, `spec.md` § 11 C9). It renders above
// the surface rather than at the foot, because a viewer who has just met a one-row table or a
// withheld profile needs it before they scroll, not after. It is on every arm for the same
// reason. C9 removed the matrix outright: it was a second information architecture explaining a
// mechanism the account switcher already demonstrates.
//
// **R-M15 — no ordering is editorialised.** The default sort is Completed Jobs descending (A24),
// the lede says so in words, and there is no percentile, no rank and no "top spender" anywhere on
// the page. Every numeric column sorts **from its own heading, and from nowhere else** (R-N15,
// ticket 63): the heading link is the Sort control, it stands on the column it orders, and the
// toolbar's menu — which listed every column twice and could disagree with the arrow on screen —
// is gone. `?sort=` is unchanged, and `sortHrefFor` below is what writes it.
//
// **The period is a calendar month, and the page opens on the current one** (ticket 63). "All
// data" is not offered: a row here is a Member's figures *over the period*, and a period of
// everything is a career total that grows without bound and puts a Member who left beside one who
// arrived last week. Team and kind stay filters over that month.

import Link from "next/link";
import { pageRequest, type PageRequest } from "@/components/controls/request";
import { controlHref } from "@/components/controls/schema";
import { DataTable } from "@/components/panels/data-table";
import { MemberProfile } from "@/components/panels/member-profile";
import { PageFrame } from "@/components/shell/page-frame";
import { peoplePage } from "@/data/queries";
import type { TableColumn, TableRow } from "@/domain/viewmodel";

export const TABLE_CAPTION = "Members, with their Jobs, tokens and cost";

const LEDE =
  "Ordered by output, never by spend. Every numeric column sorts, and no ordering is a verdict.";

const BACK_TEXT = "← All Members";

/**
 * A heading's sort link. The sorted column flips direction; every other column starts high to
 * low, because reading a table of output for its smallest value is not what anyone opens it for.
 *
 * It builds a URL and nothing else — the ordering itself is `tableViewModel`'s (R-T6), and the
 * default this page loads with is Completed Jobs descending (A24), decided in `params.ts`.
 */
const sortHrefFor =
  (request: PageRequest, sort: { readonly column: string; readonly direction: "asc" | "desc" }) =>
  (column: TableColumn): string =>
    controlHref({
      controls: request.controls,
      window: request.window,
      overrides: {
        sort: {
          column: column.key,
          direction: column.key === sort.column && sort.direction === "desc" ? "asc" : "desc",
        },
      },
    });

/** R-N16 — the Member cell addresses the profile surface. `row.key` is the Member id (R-T8). */
const profileHrefFor = (request: PageRequest) => (row: TableRow) =>
  controlHref({
    controls: request.controls,
    window: request.window,
    overrides: { member: row.key },
  });

/** The list surface: the same page with `?member=` dropped (R-C4's canonical short form). */
const listHref = (request: PageRequest): string =>
  controlHref({
    controls: request.controls,
    window: request.window,
    overrides: { member: null },
  });

export default async function PeoplePage(props: PageProps<"/[org]/people">) {
  const { org } = await props.params;
  const request = await pageRequest("people", org, await props.searchParams);
  const view = peoplePage(request.viewer, request.controls);

  return (
    <PageFrame request={request} title="People" lede={LEDE}>
      <p
        data-testid="visibility-statement"
        className="max-w-3xl text-sm leading-relaxed text-muted-foreground"
      >
        {view.visibility}
      </p>

      {view.surface === "table" ? (
        <DataTable
          table={view.table}
          caption={TABLE_CAPTION}
          sortHrefOf={sortHrefFor(request, view.table.sort)}
          linkFor={{ column: "member", hrefOf: profileHrefFor(request) }}
        />
      ) : null}

      {view.surface === "profile" ? (
        <MemberProfile profile={view.profile} backHref={listHref(request)} />
      ) : null}

      {view.surface === "withheld" ? (
        <section
          aria-label="Withheld profile"
          className="rounded-xl border border-dashed border-border p-6"
        >
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{view.message}</p>
          <Link
            href={listHref(request)}
            className="mt-3 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {BACK_TEXT}
          </Link>
        </section>
      ) : null}
    </PageFrame>
  );
}

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
// account's twenty: it gets its own row, and a sentence saying how many Members reached the
// totals through an aggregated grant without being named. That sentence is the mechanism
// ADR-0003 kept, made visible, and it is why the account switch reads as a different page rather
// than a shorter one.
//
// **The permission matrix renders at the foot for both accounts** (R-A10, `spec.md` § 11 C6),
// collapsed and read-only, each showing its own grants — it is on every arm of the ViewModel, so
// a viewer who has just been told a profile is withheld can open the reason underneath it. A28
// and T-E8 read the other way; see `permission-matrix.tsx` and the ticket's Comments.
//
// **R-M15 — no ordering is editorialised.** The default sort is Completed Jobs descending (A24),
// the lede says so in words, and there is no percentile, no rank and no "top spender" anywhere on
// the page. Every numeric column sorts, from its own heading and from the toolbar (R-N15).

import Link from "next/link";
import { pageRequest, type PageRequest } from "@/components/controls/request";
import { controlHref } from "@/components/controls/schema";
import { DataTable } from "@/components/panels/data-table";
import { MemberProfile } from "@/components/panels/member-profile";
import { PermissionMatrixPanel } from "@/components/panels/permission-matrix";
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

      <PermissionMatrixPanel matrix={view.matrix} />
    </PageFrame>
  );
}

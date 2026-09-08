// **R-A10 — the read-only permission matrix, collapsed, at the foot of `/demo/people`.**
//
// It renders **for both accounts**, each seeing its own grants. Under R-A3.1 `self` is granted
// over every class to every Role — including `access` — so a Member whose tables have just
// shrunk can always reach the page that explains why. `spec.md` § 11 C6 is the resolution that
// made it so, and it argues that the literal reading of ticket 10's grant list produces "a
// matrix nobody can see": neither account holds `access`, and the one viewer who needs the
// explanation is the one who cannot have it.
//
// **A28 and T-E8 say the opposite of R-A10, in terms, and this component does not settle that.**
// They read "the permission matrix renders for the open account and not for the restricted one";
// R-A10 and C6 are the later text and say both see it. Ticket 21 built the domain layer on
// R-A10 — `holds()` returns `true` for every `self` cell ahead of the grant lookup, and
// `grantMatrix` therefore returns a *different* matrix per Role rather than nothing for one of
// them — so "the restricted account holds no `access`" is not expressible below this line at
// all. Implemented to R-A10 because that is what the domain layer can express; the contradiction
// is a human decision and is recorded in `.scratch/agent-dash/issues/35-demo-people.md`.
//
// **Read-only is a property of what is written, not of what is disabled.** There is no input,
// no checkbox, no button and no handler here — a granted cell is a glyph with a word beside it
// for a screen reader. A disabled control would still be a control.
//
// **It computes nothing** (R-T6). All 24 cells arrived resolved on the ViewModel, `self` row
// included, and the two dimensions (subject scope × datapoint class) arrived as lists.

import type { PermissionMatrixViewModel } from "@/data/queries";
import type { DatapointClass, SubjectScope } from "@/domain/access";
import { cn } from "@/lib/utils";

/** Copy. Every key below is a member of a closed vocabulary in `src/domain/access.ts`. */
const SCOPE_LABELS: Readonly<Record<SubjectScope, string>> = {
  self: "Yourself",
  peer: "Named Members of your own Team",
  team: "Your own Team",
  "peer-team": "Other Teams",
  org: "The whole Organization",
  "org-member": "Named Members across the Organization",
};

const DATAPOINT_LABELS: Readonly<Record<DatapointClass, string>> = {
  jobs: "Jobs",
  tokens: "Tokens",
  cost: "Cost",
  access: "Access",
};

/**
 * The second dimension of the model, in words. `team` reaches a teammate's rows so their
 * figures land in a total; it never resolves that teammate to a name, which is exactly why the
 * restricted account's table is short and unnamed rather than merely short.
 */
const RESOLUTION_LABELS = {
  aggregated: "counted, never named",
  identified: "named",
} as const;

const GRANTED_GLYPH = "✓";
const UNGRANTED_GLYPH = "·";

export const MATRIX_SUMMARY = "Permissions — what this account can see";

/**
 * The panel's handle for the two suites that have to *find* it — the component test and
 * `e2e/people.spec.ts`. A `<details>` carries no accessible name of its own and its own summary
 * is the only text in it before it is opened, so a queryable id is the honest way to reach it.
 */
export const MATRIX_TEST_ID = "permission-matrix";

export const matrixCaption = (roleName: string): string =>
  `${roleName}: granted permissions by subject scope and datapoint class`;

export function PermissionMatrixPanel(props: { readonly matrix: PermissionMatrixViewModel }) {
  const { matrix } = props;

  return (
    <details
      // Collapsed (R-A10). `<details>` is closed unless `open` is set, so "collapsed" is the
      // absence of an attribute rather than a class that could be overridden.
      data-testid={MATRIX_TEST_ID}
      className="mt-10 rounded-xl border border-border bg-muted/20"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <span className="mr-2 text-muted-foreground">▸</span>
        {MATRIX_SUMMARY}
        <span className="ml-2 font-normal text-muted-foreground">— {matrix.roleName}</span>
      </summary>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{matrixCaption(matrix.roleName)}</caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Whose data
                </th>
                {matrix.datapoints.map((datapoint) => (
                  <th
                    key={datapoint}
                    scope="col"
                    className="px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {DATAPOINT_LABELS[datapoint]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.scope} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-foreground">
                    {SCOPE_LABELS[row.scope]}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {RESOLUTION_LABELS[row.resolution]}
                    </span>
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.datapoint}
                      data-scope={row.scope}
                      data-datapoint={cell.datapoint}
                      data-granted={String(cell.granted)}
                      className={cn(
                        "px-3 py-2 text-center",
                        cell.granted ? "text-foreground" : "text-muted-foreground/50",
                      )}
                    >
                      <span aria-hidden="true">
                        {cell.granted ? GRANTED_GLYPH : UNGRANTED_GLYPH}
                      </span>
                      <span className="sr-only">
                        {cell.granted ? "granted" : "not granted"}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{matrix.note}</p>
      </div>
    </details>
  );
}

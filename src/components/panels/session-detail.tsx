// **R-N20.1 — one session's four disjoint token class volumes and its Model mix.**
//
// **This is the only surface in the product carrying either.** R-M7 forbids Model as an axis on
// any aggregate, so a per-session Model mix is legal *only* here; and the four token classes
// appear elsewhere only as rate-card *columns*, never as volumes. That makes this component the
// one place where `CONTEXT.md` § Models & Money is visible on screen rather than only provable
// in the domain layer — which is why T-C9.1 asserts against its rendered output.
//
// **It computes nothing** (R-T6). The four volumes, their total and every Model's volume arrived
// on the `SessionDetail`. There is no share, no percentage and no ranking here: a share would be
// a division, and a division in a component is the seam leaking. The volumes are shown as
// volumes, and the reader adds them if they want to — which is exactly what T-C9.1 does.
//
// **`null` is withheld, not zero** (R-A6). A viewer whose grants reach this session only in
// aggregate gets a sentence saying so, never a table of zeroes.
//
// **R-N20.2 — the child sessions sit under the same expansion.** A root's figures above them are
// the whole tree's (R-M19), so the children are a breakdown of the row the reader opened rather
// than rows to be added to it — which is why they are listed here, indented, and never as rows in
// the table. Each carries its own tokens and Model mix, because a fan-out that used a different
// model from its root is the one thing this list is worth reading for.

import type { ReactNode } from "react";
import type { TokenClass } from "@/domain/types";
import type { HistoryChildRow, SessionDetail } from "@/data/queries";
import { usd, WITHHELD as ABSENT } from "./figures";

/** Deterministic and locale-pinned, exactly as `data-table.tsx` pins it. */
const volume = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * R-N20.1's four classes, in the order the expanded row lists them: the two input classes, the
 * cache write that is neither, then output. Copy, and only copy — the vocabulary itself is
 * `src/domain/types.ts`'s, and `Record<TokenClass, string>` makes leaving one out a type error.
 */
const TOKEN_CLASS_LABELS: Readonly<Record<TokenClass, string>> = {
  uncached_input: "Uncached input",
  cache_read: "Cache read",
  cache_write: "Cache write",
  output: "Output",
};

const TOKEN_CLASS_ORDER: readonly TokenClass[] = [
  "uncached_input",
  "cache_read",
  "cache_write",
  "output",
];

const WITHHELD_NOTE =
  "Token volumes and Model mix for this session are outside your grants: your scope reaches it " +
  "in aggregate only, so there is a figure here and it is not yours to read.";

// Whole-step spacing utilities only. A class like `py-1.5` puts the literal `1.5` in the
// response body, where T-E4's decimal search cannot tell it from a leaked cost figure — a
// collision that costs nothing to avoid and is confusing to diagnose.
const CELL = "px-3 py-2 text-right tabular-nums text-foreground";
const LABEL = "px-3 py-2 text-left font-normal text-muted-foreground";

function DetailTable(props: {
  readonly caption: string;
  readonly lede: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="min-w-0 flex-1">
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {props.caption}
      </h4>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground/80">
        {props.lede}
      </p>
      <table className="mt-2 w-full max-w-sm border-collapse text-sm">
        <caption className="sr-only">{props.caption}</caption>
        {props.children}
      </table>
    </section>
  );
}

/** The four disjoint classes and the figure they sum to — the whole of R-M9, on screen. */
function TokenClasses(props: {
  readonly byClass: Readonly<Record<TokenClass, number>>;
  readonly processed: number;
}) {
  return (
    <DetailTable
      caption="Token classes"
      lede="Four disjoint classes. They partition the session, so they add up to Tokens processed."
    >
      <tbody data-testid="token-class-volumes">
        {TOKEN_CLASS_ORDER.map((tokenClass) => (
          <tr key={tokenClass} className="border-b border-border/40">
            <th scope="row" className={LABEL}>
              {TOKEN_CLASS_LABELS[tokenClass]}
            </th>
            <td className={CELL}>{volume.format(props.byClass[tokenClass])}</td>
          </tr>
        ))}
      </tbody>
      <tfoot data-testid="token-class-total">
        <tr>
          <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
            Tokens processed
          </th>
          <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">
            {volume.format(props.processed)}
          </td>
        </tr>
      </tfoot>
    </DetailTable>
  );
}

/** Per-session Model mix. Legal here and nowhere else (R-M7) — a session may span several. */
function ModelMix(props: {
  readonly mix: readonly { readonly key: string; readonly label: string; readonly value: number }[];
}) {
  return (
    <DetailTable
      caption="Model mix"
      lede="This session's models, as volumes. Model is a per-session breakdown and never a comparison axis."
    >
      <tbody data-testid="model-mix">
        {props.mix.map((model) => (
          <tr key={model.key} className="border-b border-border/40">
            <th scope="row" className={LABEL}>
              {model.label}
            </th>
            <td className={CELL}>{volume.format(model.value)}</td>
          </tr>
        ))}
      </tbody>
    </DetailTable>
  );
}

/** R-N20.2 — the fan-out's figures, in the units the row above them uses. */
const childTokens = (detail: SessionDetail): string =>
  detail.tokensProcessed === null ? ABSENT : volume.format(detail.tokensProcessed);

const childModels = (detail: SessionDetail): string =>
  detail.modelMix === null || detail.modelMix.length === 0
    ? ABSENT
    : detail.modelMix.map((model) => model.label).join(" · ");

/**
 * **R-N20.2 — the agents this attempt fanned out to**, indented under it, in start order.
 *
 * The figures above already contain them, so nothing here is added to anything — and the cost
 * goes through `usd`, the product's one money formatter (A31), because a child's cost is the same
 * kind of figure as the Cost column two lines above it.
 */
export function SessionChildren(props: { readonly rows: readonly HistoryChildRow[] }) {
  const { rows } = props;
  if (rows.length === 0) return null;

  return (
    <section data-testid="session-children" className="min-w-0">
      <h4 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Sub-agent sessions
      </h4>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground/80">
        {rows.length === 1 ? "One agent ran" : `${rows.length} agents ran`} inside this session.
        Their cost, tokens and machine time are already in the row above.
      </p>
      <ul className="mt-2 space-y-2 border-l-2 border-chart-2/60 pl-4">
        {rows.map((child) => (
          <li key={child.key} data-child={child.key} className="text-sm text-foreground">
            <span className="tabular-nums text-muted-foreground">{child.startedAt}</span>
            <span className="px-2 text-muted-foreground/60">·</span>
            <span className="tabular-nums">{volume.format(child.durationSeconds)} s</span>
            <span className="px-2 text-muted-foreground/60">·</span>
            <span className="tabular-nums">{childTokens(child.detail)} tokens</span>
            <span className="px-2 text-muted-foreground/60">·</span>
            <span className="tabular-nums">{usd(child.cost)}</span>
            <span className="block text-xs text-muted-foreground">{childModels(child.detail)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SessionDetailPanel(props: { readonly detail: SessionDetail }) {
  const { detail } = props;

  if (detail.tokensByClass === null || detail.tokensProcessed === null || detail.modelMix === null) {
    return (
      <p data-testid="session-detail" className="max-w-2xl text-sm text-muted-foreground">
        {WITHHELD_NOTE}
      </p>
    );
  }

  return (
    <div
      data-testid="session-detail"
      className="flex flex-col gap-6 border-l-2 border-chart-1/60 pl-4 sm:flex-row sm:gap-10"
    >
      <TokenClasses byClass={detail.tokensByClass} processed={detail.tokensProcessed} />
      {detail.modelMix.length > 0 ? <ModelMix mix={detail.modelMix} /> : null}
    </div>
  );
}

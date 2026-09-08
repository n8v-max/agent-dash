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

import type { ReactNode } from "react";
import type { TokenClass } from "@/domain/types";
import type { SessionDetail } from "@/data/queries";

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

const WITHHELD =
  "Token volumes and Model mix for this session are outside your grants: your scope reaches it " +
  "in aggregate only, so there is a figure here and it is not yours to read (R-A6).";

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
      lede="This session's models, as volumes. Model is a per-session breakdown and never a comparison axis (R-M7)."
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

export function SessionDetailPanel(props: { readonly detail: SessionDetail }) {
  const { detail } = props;

  if (detail.tokensByClass === null || detail.tokensProcessed === null || detail.modelMix === null) {
    return (
      <p data-testid="session-detail" className="max-w-2xl text-sm text-muted-foreground">
        {WITHHELD}
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

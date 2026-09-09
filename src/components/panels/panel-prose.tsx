// **R-V14 — a panel states one sentence and folds the rest behind "Why this number".**
//
// Seven panels on `/demo/spend` and six on `/demo/work` each carried a three-sentence paragraph
// under their heading, and the page was read past all of it: a wall of justification above a chart
// is prose a viewer skips, which means the *first* sentence — the one saying what the panel
// answers — was skipped with it. One sentence is what a reader takes at the ten-second bar
// (ticket 03); the argument is what they want on the second pass, and only then.
//
// **Nothing is deleted; it is relocated** — ticket 45 states the rule as *no ADR argument is
// deleted, it is folded*. Several of these paragraphs carry an ADR's reasoning — ADR-0004's flat
// Repository on Cost by Repository, ADR-0005's attributed cost on Cost per session, R-M5's
// whole-month seat charge on Total spend — and shortening one would lose a position the project's
// own docs record. The fold is therefore **mechanical**: the first sentence stays, and everything
// after it goes into the disclosure verbatim. `splitProse` is the one expression that decides the
// cut, and T-C20 asserts the round trip — the claim a screenshot could never make.
//
// **A native `<details>`, so the disclosure costs no client JavaScript.** No handler, no state,
// no hydration: it works in a document with scripting off, it is keyboard-reachable and
// screen-reader-announced for free, and it keeps every panel chrome in this directory a Server
// Component. A button and a `useState` would have bought exactly the same interaction at the
// price of the seam.
//
// **It computes nothing** (R-T6). The copy arrives as a string — a panel's own or a ViewModel's —
// and this module cuts it in one place and renders both halves.

import { cn } from "@/lib/utils";

/** The disclosure's label. One phrase, every panel, so it reads as one affordance. */
export const WHY_THIS_NUMBER = "Why this number";

/** A panel's prose, cut once: the sentence a reader sees, and the argument behind it. */
export type Prose = {
  readonly lead: string;
  /** `null` where the copy is a single sentence — then there is no disclosure to offer. */
  readonly rest: string | null;
};

/**
 * **The fold, in one expression** (T-C20).
 *
 * A sentence ends at `.`, `!` or `?` **followed by whitespace**, which is what keeps `42.5`,
 * `p95.` and `0.86` inside the sentence that states them rather than cutting a figure in half.
 * Copy with no terminator at all is one sentence by definition and is returned whole.
 */
export const splitProse = (text: string): Prose => {
  const trimmed = text.trim();
  const end = /[.!?]\s/.exec(trimmed);
  if (!end) return { lead: trimmed, rest: null };

  const rest = trimmed.slice(end.index + 1).trim();
  return { lead: trimmed.slice(0, end.index + 1), rest: rest.length > 0 ? rest : null };
};

/** The two type scales the panel chromes read at: `PanelCard` is `sm`, `WorkPanel` is `xs`. */
const SCALE = { sm: "text-sm", xs: "text-xs" } as const;

export function PanelProse(props: {
  /** The panel's copy. `null` or empty renders nothing — absent, not an empty paragraph. */
  readonly text?: string | null;
  readonly scale?: keyof typeof SCALE;
  readonly className?: string;
}) {
  if (!props.text) return null;

  const { lead, rest } = splitProse(props.text);
  const size = SCALE[props.scale ?? "sm"];

  return (
    <div data-testid="panel-prose" className={cn("max-w-3xl", props.className)}>
      <p className={cn("leading-relaxed text-muted-foreground", size)}>{lead}</p>
      {rest ? (
        <details className="mt-1">
          <summary
            className={cn(
              "w-fit cursor-pointer list-none text-xs font-medium text-muted-foreground",
              "underline decoration-dotted underline-offset-4 hover:text-foreground",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              "marker:content-none",
            )}
          >
            {WHY_THIS_NUMBER}
          </summary>
          <p className={cn("mt-2 leading-relaxed text-muted-foreground", size)}>{rest}</p>
        </details>
      ) : null}
    </div>
  );
}

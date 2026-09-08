// `/` — the landing page (R-N1, ticket 37).
//
// **The line is the page.** Scope is a positioning line and one link to sign-in: no feature grid,
// no pricing, no comparison table. Those were argued out on ticket 37, and the restraint is the
// same argument the dashboard makes — a product that declines to state a productivity gain should
// not open by listing everything it does.
//
// **What the copy carries** — ticket 05's settled position:
//
//   * The spine is **cost control**; the differentiator is **joining cost to efficacy**. "Per
//     finished task" is that join in three words: attempts that produced nothing sit in the
//     numerator and not the denominator, so waste raises the figure.
//   * **Nothing about speed, productivity gain, or engineers shipping more.** Measuring a gain
//     needs a pre-agent baseline and the observation window is entirely agent-assisted, so the
//     product makes no such claim and the hero must not reintroduce the premise.
//
// **"Measured", not "priced".** A vendor's verb on a hero reads as how this product charges you,
// which is not what the line is about.
//
// **"Not per seat" is a claim about the reported unit, not the numerator.** Total spend *does*
// include seat cost — it is R-D4's headline finding, about 48% of it — and the contrast is with
// per-seat and per-token *pricing models*, not with this product's cost base. Recorded here
// because a reader who takes it the other way will find the apparent contradiction one click in.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "agent-dash" },
  description: "Agent spend, measured per finished task.",
};

const LINE = "Agent spend, measured per finished task. Not per token, not per seat.";

const SUPPORTING =
  "Attempts that finished nothing still cost money, and they are in the numerator. Waste raises " +
  "the figure rather than hiding in it.";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
        {LINE}
      </h1>

      <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
        {SUPPORTING}
      </p>

      <Link
        href="/sign-in"
        className="w-fit rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/40"
      >
        See the dashboard
      </Link>
    </main>
  );
}

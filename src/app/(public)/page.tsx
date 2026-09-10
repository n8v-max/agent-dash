// `/` — the landing page (R-N1; ticket 37, reshaped by tickets 59 and 60).
//
// **Slogan, paragraph, one link, four reads, one closing line.** The one-line landing of ticket
// 37 read as obscure and offered nothing before the click; ticket 59 carries the human's
// reasoning for what replaced it — jobs-to-be-done for the VP of Engineering, the four value
// points that survived a seven-point stack rank, and why the fourth is about efficiency rather
// than money. The copy here is the human's, verbatim from ticket 60, and the render at
// `docs/landing/img/picture-v2.png` is the spec for layout and type.
//
// **What still holds from ticket 37.** R-N1's single link: exactly one anchor on the page, to
// `/sign-in`. The refused claim: nothing about speed, productivity gain, or engineers shipping
// more, because measuring a gain needs a pre-agent baseline and the window is entirely
// agent-assisted. Both are tests, not intentions.
//
// **"Per finished job"** is still the join of cost to efficacy in three words — attempts that
// produced nothing sit in the numerator and not the denominator, so waste raises the figure — and
// the first read says exactly that.
//
// **The MCP line is a promise.** *Ask, don't dig* names a surface that does not exist yet; the
// human chose to ship the line and to put the surface first under *Next* in `docs/roadmap.md`.

import type { Metadata } from "next";
import Link from "next/link";
import { Reads } from "./reads";

export const metadata: Metadata = {
  title: { absolute: "agent-dash" },
  description: "What your agents do, spend and solve, per finished job.",
};

const LEDE =
  "Accountability for agent use: where it converts, where it leaks, and who has it figured " +
  "out. Every attempt is priced, keyed to an issue and a person, and counted only when its " +
  "work was accepted.";

const ASK =
  "Every figure about agent work in your organisation, from the bill to where it converts and " +
  "which teams run lean, is available over MCP to whichever AI assistant your team already " +
  "uses. Connect it once and ask in plain words.";

export default function Home() {
  return (
    <main className="landing-column pb-24 pt-20 lg:pt-[120px]">
      <h1 className="landing-serif landing-rise m-0 mb-7 max-w-[980px] text-balance text-[40px] leading-[1.04] lg:text-[72px]">
        What your agents do, spend and solve, <em className="font-light italic">per finished job.</em>
      </h1>

      <p className="landing-rise landing-rise-2 m-0 mb-10 max-w-[640px] text-pretty text-[17px] leading-[1.55] text-(--landing-ink-2) lg:text-[19px]">
        {LEDE}
      </p>

      <Link
        href="/sign-in"
        className="landing-rise landing-rise-3 inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-(--landing-ink) px-6 py-[13px] text-[15px] font-semibold text-(--landing-ink) no-underline transition-colors hover:bg-(--landing-ink)/5"
      >
        Open the demo →
      </Link>

      <p className="m-0 mt-24 border-t border-(--landing-ink) pt-3.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-(--landing-ink)">
        One tool, four reads
      </p>

      <Reads />

      <p className="m-0 mt-16 max-w-[720px] border-t border-(--landing-rule) pt-[22px] text-[15.5px] leading-[1.55] text-(--landing-ink-2)">
        <b className="font-semibold text-(--landing-ink)">Ask, don&apos;t dig.</b> {ASK}
      </p>
    </main>
  );
}

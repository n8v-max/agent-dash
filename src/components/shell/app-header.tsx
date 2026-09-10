// **R-N3 — the header.** Product mark · nav · account switcher, sticky at the top of every
// `/[org]/**` surface.
//
// **The header holds *who you are*; the toolbar below holds *what is in the URL*.** They are two
// different kinds of state and they are two visibly different bars: the header does not change
// when a control does, and no control appears in it. Keeping them separate is what stops a viewer
// reading the account switcher as another filter.
//
// **No sidebar** (R-N3). Six items do not fill one, and the seven-column People table and the
// acceptance small multiples both want the horizontal space.
//
// **On a phone the bar is two rows, not fewer doors** (R-V15, ticket 46). Six labels plus the
// mark plus the switcher need 588px, which was the widest thing on every one of the six surfaces
// at 390. The row wraps instead: identity — the mark and the switcher — on the first line, the
// whole nav on the second. Nothing is hidden and nothing is moved behind a control, because
// R-A8 and R-N2 are the two rules this bar exists to keep, and a "⋯" is exactly what ticket 43
// took out.
//
// **R-A8 — one nav list, no grant consulted.** `sectionNav` below is built from `pathFor` and
// nothing else. There is no expression here that could hide or disable an item for the restricted
// account: fewer rows, never fewer doors — which is now literal, since R-N2's overflow is gone
// and all six surfaces are links in the bar.

import Link from "next/link";
import type { Account } from "@/data/accounts";
import { pathFor } from "@/components/controls/schema";
import { AccountSwitcher } from "./account-switcher";
import { ShellNav, type NavItem } from "./shell-nav";

/**
 * R-N1's six surfaces, in the order a viewer meets them: the four primary questions, then the
 * two R-N2 calls secondary. One list, because they are one navigation — the secondary pair is
 * marked rather than moved, and `ShellNav` spends that mark on weight and position, never on
 * visibility.
 */
const sectionNav = (orgSlug: string): readonly NavItem[] => [
  { href: pathFor("summary", orgSlug), label: "Summary", secondary: false },
  { href: pathFor("spend", orgSlug), label: "Spend", secondary: false },
  { href: pathFor("work", orgSlug), label: "Work", secondary: false },
  { href: pathFor("people", orgSlug), label: "People", secondary: false },
  { href: pathFor("history", orgSlug), label: "History", secondary: true },
  { href: pathFor("projection", orgSlug), label: "Projection", secondary: true },
];

export function AppHeader(props: {
  readonly orgSlug: string;
  readonly account: Account;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-[110rem] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-y-0 sm:px-6 sm:py-0">
        <Link
          href={pathFor("summary", props.orgSlug)}
          className="flex shrink-0 items-center gap-2"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-lg bg-primary text-[11px] font-bold tracking-tight text-primary-foreground"
          >
            ad
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">agent-dash</span>
        </Link>

        {/*
          A hairline between the mark and the nav: two jobs, one bar, visibly separated. It is
          gone below `sm`, where the wrap has already separated them onto two lines and a rule
          standing between the mark and the switcher would divide the wrong pair.
        */}
        <span aria-hidden className="hidden h-5 w-px bg-border sm:block" />

        <ShellNav items={sectionNav(props.orgSlug)} />

        {/* Wrapped, the switcher shares the first line with the mark and sits at its far end. */}
        <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
          <AccountSwitcher account={props.account} />
        </div>
      </div>
    </header>
  );
}

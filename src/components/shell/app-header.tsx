// **R-N3 — the header.** Product mark · nav · ellipsis · account switcher, sticky at the top of
// every `/[org]/**` surface.
//
// **The header holds *who you are*; the toolbar below holds *what is in the URL*.** They are two
// different kinds of state and they are two visibly different bars: the header does not change
// when a control does, and no control appears in it. Keeping them separate is what stops a viewer
// reading the account switcher as another filter.
//
// **No sidebar** (R-N3). Four items plus an overflow do not fill one, and the seven-column People
// table and the acceptance small multiples both want the horizontal space.
//
// **R-A8 — one nav list, no grant consulted.** `NAV` and `OVERFLOW` below are built from
// `pathFor` and nothing else. There is no expression here that could hide or disable an item for
// the restricted account: fewer rows, never fewer doors.

import Link from "next/link";
import type { Account } from "@/data/accounts";
import { pathFor } from "@/components/controls/schema";
import { AccountSwitcher } from "./account-switcher";
import { ShellNav, type NavItem } from "./shell-nav";

/** R-N1's primary questions, in the order a viewer meets them. */
const primaryNav = (orgSlug: string): readonly NavItem[] => [
  { href: pathFor("summary", orgSlug), label: "Summary", description: null },
  { href: pathFor("spend", orgSlug), label: "Spend", description: null },
  { href: pathFor("work", orgSlug), label: "Work", description: null },
  { href: pathFor("people", orgSlug), label: "People", description: null },
];

/** R-N2 — the two secondary surfaces, each carrying its one line. */
const overflowNav = (orgSlug: string): readonly NavItem[] => [
  {
    href: pathFor("history", orgSlug),
    label: "History",
    description: "The raw sessions under every aggregate on the other pages.",
  },
  {
    href: pathFor("projection", orgSlug),
    label: "Projection",
    description: "Where this month's spend lands, extrapolated from the share elapsed.",
  },
];

export function AppHeader(props: { readonly orgSlug: string; readonly account: Account }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-[110rem] items-center gap-4 px-4 sm:px-6">
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

        {/* A hairline between the mark and the nav: two jobs, one bar, visibly separated. */}
        <span aria-hidden className="h-5 w-px bg-border" />

        <ShellNav items={primaryNav(props.orgSlug)} overflow={overflowNav(props.orgSlug)} />

        <div className="ml-auto flex items-center gap-3">
          <AccountSwitcher account={props.account} />
        </div>
      </div>
    </header>
  );
}

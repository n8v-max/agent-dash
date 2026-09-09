"use client";

// The header's navigation, and the **only** Client Component in the shell.
//
// It is one because the active item is a function of the current path, and a layout does not
// re-render on a client-side navigation — a server-rendered highlight would be correct on the
// first document and stale on every soft navigation after it. `usePathname` is reactive, so this
// is the one place the answer stays right.
//
// It holds no state: no `useState`, no `useEffect`, no store. `usePathname` is a *read* of the
// URL, which is the same source of truth R-T25 names — nothing here caches or mirrors it. The
// control layer proper (`components/controls/`) carries no `"use client"` at all.
//
// **R-N2 — six links, and no overflow.** `/demo/history` and `/demo/projection` used to sit
// behind a "⋯" disclosure, on the argument that two items do not earn a grouping. They do not —
// but a menu is not a grouping either, and what the disclosure actually bought was two of the
// product's six surfaces costing a click and a guess to find. They are nav items now. Secondary
// **weight** carries what the menu was for: they are smaller, they sit apart from the four
// primary questions, and nothing about them is hidden.
//
// **R-A8 — navigation is identical for both accounts.** The items arrive as props from one list
// built without consulting a grant, and nothing below can hide or disable one: there is no
// `disabled` prop and no grant in scope.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  readonly href: string;
  readonly label: string;
  /** R-N2 — a secondary surface: smaller, set apart, never hidden. */
  readonly secondary: boolean;
};

// **R-V15 — the phone gets the same six labels, one step tighter** (ticket 46). Below `sm` the
// nav has the header's second line to itself and spends it on all six items: the padding and both
// type sizes come down a step, which is what makes six labels fit 358px of usable width instead
// of asking for 588. The labels themselves are not abbreviated — "Summary" is already the short
// form, and a nav whose words change with the viewport is a nav a viewer cannot be told about.
//
// **Both sizes move, so R-N2's step between them survives the phone.** Shrinking only the primary
// items would land them on the secondary size and flatten the one distinction this nav makes;
// the pair stays a pair, one notch smaller.
const ITEM = "rounded-lg transition-colors";
const PRIMARY = "px-1.5 py-1 text-xs font-medium sm:px-3 sm:text-sm";
/** R-N2's "secondary weight": one step down in size, and no bolder than the page around it. */
const SECONDARY = "px-1.5 py-1 text-[11px] font-medium sm:px-2 sm:text-xs";

export function ShellNav(props: { readonly items: readonly NavItem[] }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href;
  // The first secondary item opens the right-aligned group. Read off the list rather than
  // hard-coded, so the split follows `NavItem.secondary` and not a position in an array.
  const firstSecondary = props.items.find((item) => item.secondary)?.href;

  return (
    <nav
      aria-label="Sections"
      // `basis-full order-last` is the wrap: below `sm` the nav takes the header's whole second
      // line, so the mark and the switcher keep the first one.
      className="order-last flex min-w-0 basis-full items-center gap-0.5 sm:order-none sm:basis-auto sm:flex-1 sm:gap-1"
    >
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(item.href) ? "page" : undefined}
          className={cn(
            ITEM,
            item.secondary ? SECONDARY : PRIMARY,
            item.href === firstSecondary && "ml-auto",
            isCurrent(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

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

const ITEM = "rounded-lg transition-colors";
const PRIMARY = "px-3 py-1 text-sm font-medium";
/** R-N2's "secondary weight": one step down in size, and no bolder than the page around it. */
const SECONDARY = "px-2 py-1 text-xs font-medium";

export function ShellNav(props: { readonly items: readonly NavItem[] }) {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href;
  // The first secondary item opens the right-aligned group. Read off the list rather than
  // hard-coded, so the split follows `NavItem.secondary` and not a position in an array.
  const firstSecondary = props.items.find((item) => item.secondary)?.href;

  return (
    <nav aria-label="Sections" className="flex min-w-0 flex-1 items-center gap-1">
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

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
// **R-A8 — navigation is identical for both accounts.** The items arrive as props from one list
// built without consulting a grant, and nothing below can hide or disable one: there is no
// `disabled` prop and no grant in scope.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  readonly href: string;
  readonly label: string;
  /** R-N2 — the one line an overflow item carries. `null` on the primary items. */
  readonly description: string | null;
};

const ITEM = "rounded-lg px-3 py-1 text-sm font-medium transition-colors";

export function ShellNav(props: {
  readonly items: readonly NavItem[];
  readonly overflow: readonly NavItem[];
}) {
  const pathname = usePathname();
  const isCurrent = (href: string) => pathname === href;
  const overflowActive = props.overflow.some((item) => isCurrent(item.href));

  return (
    <nav aria-label="Sections" className="flex items-center gap-1">
      {props.items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrent(item.href) ? "page" : undefined}
          className={cn(
            ITEM,
            isCurrent(item.href)
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}

      {/*
        R-N2 — `/demo/history` and `/demo/projection` are secondary, so they sit behind a flat
        two-item ellipsis, each carrying a one-line description. Two items do not earn a grouping;
        a third would, and the flat list is what makes that visible.
      */}
      <details key={pathname} className="relative" suppressHydrationWarning>
        <summary
          aria-label="More sections"
          className={cn(
            ITEM,
            "flex cursor-pointer list-none items-center marker:hidden",
            "[&::-webkit-details-marker]:hidden",
            overflowActive
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          &#8943;
        </summary>
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-border bg-popover p-1 shadow-lg">
          {props.overflow.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2 transition-colors hover:bg-accent",
                isCurrent(item.href) && "bg-accent",
              )}
            >
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                {item.description}
              </span>
            </Link>
          ))}
        </div>
      </details>
    </nav>
  );
}

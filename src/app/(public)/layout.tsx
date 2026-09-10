// The public route group — `/` and `/sign-in` — and nothing else (ticket 60).
//
// **Why a route group.** The two public pages set in Fraunces and Manrope; the dashboard keeps
// Geist. `next/font` emits a font's `@font-face` and preload for every route rendered under the
// layout that declares it, so declaring the pair here — and not in the root layout — is what keeps
// the dashboard routes from loading a single Fraunces or Manrope file. Route paths do not change:
// the parentheses are organisational, not a URL segment.
//
// **The fonts ride as CSS variables, not classes.** `--font-display` and `--font-body` are set on
// the `.landing` wrapper; `landing.css` reads them, and the design tokens in `globals.css` are
// scoped under the same class. The wrapper is the `.dark` variant's hook too: the tokens invert
// under `.dark .landing`, and nothing in the page tree has to know.

import { Fraunces, Manrope } from "next/font/google";
import { cn } from "@/lib/utils";
import "./landing.css";

// Both are variable fonts, so one file per style carries every weight the page sets: Fraunces
// 300 (italic and roman, the h1's `per finished job.`) and 500; Manrope 400, 500 and 600. The
// optical-size axis is what makes Fraunces read as a display face at 72px and a text face at 13.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <div className={cn("landing", fraunces.variable, manrope.variable)}>{children}</div>;
}

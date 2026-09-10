// `/sign-in` — the landing's second screen, as a mock provider page with one demo action
// (R-A4 as amended by tickets 60, 61 and 71).
//
// **Five pills in one column.** Four of them are places: anchors to Google, Apple, GitHub and an
// SSO tenant, opened in a new window. Nothing is exchanged with any of them — the link is the
// whole integration. The fifth, under a hairline, is the only control on the page that does
// anything, and it is filled ink because a sign-in page marks its primary action.
//
// **Why the four are anchors and the fifth is a form.** An anchor cannot POST without the
// JavaScript this page refuses to ship, and a provider page is a place rather than an action; so
// the fifth pill is the page's only <form>, a plain `<form method="post">` to `POST /api/session`
// — no client component, no fetch — signing in as the **first** account `signInAccounts()`
// returns, which is R-A4's open default. Each element is the one that does its job natively, and
// the smoke test counts them by kind: five links, one form, one submit.
//
// **The restricted account is not on this page, and is not anywhere else either** (ticket 61).
// `signInAccounts()` returns the open default alone, so this page offers what the endpoint will
// mint and nothing more; the header switcher stopped offering the contractor at the same time.
// The preset, its grants and the tests that mint it directly are untouched — restriction is
// demonstrable under test, not through the UI.
//
// Nothing here explains itself: no label, no card, no sentence about what the demo is (ticket
// 71). A real sign-in page describes neither its providers nor its button, and this one now
// reads as one.

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { signInAccounts } from "@/data/accounts";
import { AppleGlyph, GitHubGlyph, GoogleGlyph, OktaGlyph } from "./provider-glyphs";

export const metadata: Metadata = {
  title: "Sign in",
};

// `zencoder.okta.com` is a placeholder tenant. The label stays generic.
const PROVIDERS: readonly { label: string; href: string; glyph: ReactNode }[] = [
  { label: "Continue with Google", href: "https://accounts.google.com/", glyph: <GoogleGlyph /> },
  { label: "Continue with Apple", href: "https://appleid.apple.com/sign-in", glyph: <AppleGlyph /> },
  { label: "Continue with GitHub", href: "https://github.com/login", glyph: <GitHubGlyph /> },
  { label: "Continue with SSO", href: "https://zencoder.okta.com/", glyph: <OktaGlyph /> },
];

/**
 * Geometry only — radius, padding, type — so the five pills are one shape. Colour is set at
 * each use, because the demo button inverts it and a `border-*` utility that loses a
 * specificity race is a hard bug to see.
 */
const PILL =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-full px-4 py-3 text-[14px] font-semibold";

/**
 * One column at every breakpoint. Four pills at their natural width do not fit a 560px row, and
 * the side-by-side arrangement was only ever possible because there were three.
 */
function ProviderPills() {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {PROVIDERS.map((provider) => (
        <li key={provider.href} className="min-w-0">
          <a
            href={provider.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${PILL} border border-(--landing-rule) bg-(--landing-claims) text-(--landing-ink) no-underline transition-colors hover:border-(--landing-ink)`}
          >
            {provider.glyph}
            <span>{provider.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-4 text-[12.5px] text-(--landing-ink-3)">
      <span aria-hidden="true" className="h-px flex-1 bg-(--landing-rule)" />
      or
      <span aria-hidden="true" className="h-px flex-1 bg-(--landing-rule)" />
    </div>
  );
}

/**
 * The page's only form, and its only two children: the id being claimed, and the button that
 * claims it. It is named by `aria-label` rather than by a heading — the name exists for the
 * accessibility tree and for the test that reaches it there, not for the page, which says
 * nothing about itself.
 */
function DemoForm(props: { readonly memberId: string }) {
  return (
    <form method="post" action="/api/session" aria-label="Demo account">
      <input type="hidden" name="member_id" value={props.memberId} />
      <button
        type="submit"
        className={`${PILL} border border-(--landing-ink) bg-(--landing-ink) text-(--landing-paper) transition-opacity hover:opacity-90`}
      >
        Sign in to the demo account
      </button>
    </form>
  );
}

export default function SignInPage() {
  // R-A4 as amended: one offered account, the open default. Read, not hardcoded, so the id stays
  // the fixture's.
  const [openDefault] = signInAccounts();
  if (!openDefault) throw new Error("R-A3: no seeded account to sign in as.");

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-8 px-6 pb-24 pt-20 lg:pt-[120px]">
      <h1 className="landing-serif m-0 text-[30px] leading-[1.08] lg:text-[40px]">Sign in</h1>

      <p className="m-0 -mt-4 text-pretty text-[17px] leading-[1.55] text-(--landing-ink-2)">
        Use your organisation&apos;s identity, or step straight into the demo.
      </p>

      <ProviderPills />
      <Divider />
      <DemoForm memberId={openDefault.memberId} />

      <Link
        href="/"
        className="w-fit text-[14px] text-(--landing-ink-2) no-underline transition-colors hover:text-(--landing-ink)"
      >
        Back
      </Link>
    </main>
  );
}

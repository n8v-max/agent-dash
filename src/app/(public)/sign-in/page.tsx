// `/sign-in` — the landing's second screen, as a mock provider page with one demo action
// (R-A4 as amended by ticket 60).
//
// **Three provider pills, an SSO input, and one working control.** The provider pills are
// anchors to the real provider sign-in pages, opened in a new window; nothing is exchanged with
// the provider and the link is the whole integration. The SSO block is disabled and says so.
// The demo card holds the page's only <form>: the same plain `<form method="post">` to
// `POST /api/session` as before — no client component, no JavaScript, no fetch — signing in as
// the **first** account `signInAccounts()` returns, which is R-A4's open default.
//
// **The restricted account is not on this page.** It stays seeded, stays in `signInAccounts()`,
// and is reached through the header account switcher (R-A5), which is where the README's
// thirty-second path already switches. The sentence under the button says so instead of
// offering it, so the page has one action and the demonstration of restriction happens where
// restriction is visible: on a page that has just lost rows.
//
// **Why the pills are anchors and the demo action is a button.** An anchor cannot POST without
// JavaScript; a provider page is a place, not an action. Each element is the one that does its
// job natively, and the smoke test counts them by kind: four links, one form, one submit.

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { signInAccounts } from "@/data/accounts";
import { AppleGlyph, GitHubGlyph, GoogleGlyph } from "./provider-glyphs";

export const metadata: Metadata = {
  title: "Sign in",
};

const PROVIDERS: readonly { label: string; href: string; glyph: ReactNode }[] = [
  { label: "Continue with Google", href: "https://accounts.google.com/", glyph: <GoogleGlyph /> },
  { label: "Continue with Apple", href: "https://appleid.apple.com/sign-in", glyph: <AppleGlyph /> },
  { label: "Continue with GitHub", href: "https://github.com/login", glyph: <GitHubGlyph /> },
];

const PILL =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-(--landing-rule) px-4 py-3 text-[14px] font-semibold text-(--landing-ink) transition-colors";

const SMALL_CAPS = "text-[11px] font-semibold uppercase tracking-[0.12em]";

function ProviderRow() {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:flex-row">
      {PROVIDERS.map((provider) => (
        <li key={provider.href} className="min-w-0 flex-1">
          <a
            href={provider.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${PILL} bg-(--landing-claims) no-underline hover:border-(--landing-ink)`}
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

function SsoBlock() {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="sso-email" className={`${SMALL_CAPS} text-(--landing-ink-3)`}>
        Work email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="sso-email"
          type="email"
          placeholder="you@company.com"
          disabled
          className="min-w-0 flex-1 rounded-full border border-(--landing-rule) bg-(--landing-claims) px-4 py-3 text-[14px] text-(--landing-ink) placeholder:text-(--landing-ink-3) disabled:opacity-60"
        />
        <button
          type="button"
          disabled
          title="Not connected in the demo"
          className={`${PILL} sm:w-auto disabled:cursor-not-allowed disabled:opacity-60`}
        >
          Continue with SSO
        </button>
      </div>
      <p className="m-0 text-[12.5px] text-(--landing-ink-2)">
        Single sign-on is not connected in the demo.
      </p>
    </div>
  );
}

function DemoCard({ memberId }: { readonly memberId: string }) {
  return (
    <form
      method="post"
      action="/api/session"
      aria-labelledby="demo-account"
      className="flex flex-col gap-4 rounded-[18px] border border-(--landing-rule) bg-(--landing-claims) p-6"
    >
      <input type="hidden" name="member_id" value={memberId} />
      <p id="demo-account" className={`m-0 ${SMALL_CAPS} text-(--landing-ink-3)`}>
        Demo account
      </p>
      <p className="m-0 text-pretty text-[15px] leading-[1.55] text-(--landing-ink-2)">
        You will be Nuria Castells Vidal, the open default: every Member by name, their jobs,
        their tokens, their cost.
      </p>
      <button
        type="submit"
        className="w-full rounded-full border border-(--landing-ink) bg-(--landing-ink) px-6 py-[13px] text-[15px] font-semibold text-(--landing-paper) transition-opacity hover:opacity-90"
      >
        Sign in to the demo account
      </button>
      <p className="m-0 text-[13px] text-(--landing-ink-2)">
        Switch to the restricted contractor view from the header on any page.
      </p>
    </form>
  );
}

export default function SignInPage() {
  // R-A4 order: the open default first. Read, not hardcoded, so the id stays the fixture's.
  const [openDefault] = signInAccounts();
  if (!openDefault) throw new Error("R-A3: no seeded account to sign in as.");

  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-8 px-6 pb-24 pt-20 lg:pt-[120px]">
      <h1 className="landing-serif m-0 text-[30px] leading-[1.08] lg:text-[40px]">Sign in</h1>

      <p className="m-0 -mt-4 text-pretty text-[17px] leading-[1.55] text-(--landing-ink-2)">
        Use your organisation&apos;s identity, or step straight into the demo.
      </p>

      <ProviderRow />
      <Divider />
      <SsoBlock />
      <DemoCard memberId={openDefault.memberId} />

      <Link
        href="/"
        className="w-fit text-[14px] text-(--landing-ink-2) no-underline transition-colors hover:text-(--landing-ink)"
      >
        Back
      </Link>
    </main>
  );
}

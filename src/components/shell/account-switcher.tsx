// **R-A5 — the account switcher.** It re-issues the token and reloads *in place*, so the viewer
// stays on the URL they were reading and the difference reads as *the same page with fewer rows*.
//
// A plain `<form method="post">`, exactly as `/sign-in` is: the endpoint answers 303 with a
// `Set-Cookie`, which is a thing a browser does natively. No client component, no `fetch`, and
// therefore nothing to keep in sync with the URL.
//
// **How the current URL survives the round trip.** The form cannot carry the path as a hidden
// field, because a layout is rendered once and preserved across client-side navigations — a field
// written at render time would be right on the first document and stale after the first soft
// navigation. So the return path is taken from the request's own `Referer`, which the browser
// recomputes for every submission and which therefore cannot go stale. `POST /api/session`
// validates it against the account's Organization before honouring it, so it is a *return* path
// and not an open redirect.
//
// **R-A8 — this is the only thing in the header that differs between the two accounts, and it
// differs in what it says, not in what it offers.** Both accounts see both entries.
//
// **The entries name Roles and Organizations, not people** (R-A6). The switch is a change of
// *grants*, so the Role is the honest label — and it is also the only one that holds: another
// Member's name in this menu would be a named individual in the payload of a viewer holding no
// identifying scope over them, which is exactly the leak T-E4 exists to catch. The viewer's *own*
// name renders on the trigger and on their own entry, where R-A3.1's universal `self` grant makes
// it theirs to see; no other entry carries a name. Ticket 58 asked for "user name, org name and
// role" in this menu, and this is that request minus the one part of it that would re-open T-E4.
//
// **The Organization group (ticket 58).** Tenancy is a Membership, so a Member can in principle
// hold Roles in several Organizations and the switch is then a change of *tenant* as well as of
// grants. The group renders only when this Member holds more than one, which in the committed
// fixture is never — one Organization is seeded. It is covered by unit tests that hand this
// component a two-Organization list directly, which is why `organizations` is a prop and not a
// `loadDataset()` call: a server component that reads the fixture itself cannot be handed a
// world with two Organizations in it.

import { signInAccounts, type Account } from "@/data/accounts";
import type { Organization } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Copy for R-A3's two shipped Roles, keyed on the name the preset itself carries. */
const ROLE_LINES: Readonly<Record<string, string>> = {
  "Open default": "Named usage and spend for everyone in the Organization.",
  "Restricted (contractor)": "Their own data, plus their Team's totals for jobs and tokens.",
};

/**
 * One offered account. The name shown is the *acting* Member's own or nobody's: R-A3.1 grants
 * `self` over every class to every Role, so a viewer may always read their own name, and the
 * other entry is labelled by Organization and Role because naming that Member would put a
 * person in the payload of a viewer holding no identifying scope over them (T-E4).
 */
function AccountEntry(props: { readonly candidate: Account; readonly acting: Account }) {
  const isActing = props.candidate.memberId === props.acting.memberId;

  return (
    <form method="post" action="/api/session">
      <input type="hidden" name="member_id" value={props.candidate.memberId} />
      <button
        type="submit"
        aria-current={isActing ? "true" : undefined}
        className={cn(
          "block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
          isActing && "bg-accent",
        )}
      >
        <span className="block text-sm font-medium text-foreground">
          {isActing ? props.acting.fullName : props.candidate.roleName}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {props.candidate.orgName} · {props.candidate.roleName}
        </span>
        <span className="block text-xs text-muted-foreground">
          {ROLE_LINES[props.candidate.roleName] ?? "A seeded account."}
        </span>
      </button>
    </form>
  );
}

/**
 * The Organizations this Member could switch *to* — empty, and so absent, whenever they hold one
 * Membership. Its own component because the switcher is at the lint layer's function-length
 * ceiling, and because "does this render at all" is the branch the unit tests target.
 */
function OrganizationGroup(props: {
  readonly memberId: string;
  readonly elsewhere: readonly Organization[];
}) {
  if (props.elsewhere.length === 0) return null;

  return (
    <div data-testid="switch-organization" className="border-t border-border/70 pt-1">
      <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Switch organisation
      </p>
      {props.elsewhere.map((organization) => (
        <form key={organization.id} method="post" action="/api/session">
          <input type="hidden" name="member_id" value={props.memberId} />
          <input type="hidden" name="org_slug" value={organization.slug} />
          <button
            type="submit"
            className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
          >
            <span className="block text-sm font-medium text-foreground">{organization.name}</span>
            <span className="block text-xs text-muted-foreground">
              Your Role there may differ from your Role here.
            </span>
          </button>
        </form>
      ))}
    </div>
  );
}

export function AccountSwitcher(props: {
  readonly account: Account;
  /** Every Organization the acting Member holds a Membership in. One entry means no group. */
  readonly organizations: readonly Organization[];
}) {
  const accounts = signInAccounts();
  const elsewhere = props.organizations.filter(
    (organization) => organization.slug !== props.account.orgSlug,
  );

  return (
    <details key={props.account.memberId} className="relative" suppressHydrationWarning>
      <summary
        data-testid="account-switcher"
        className={cn(
          "flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border",
          "bg-background py-1 pl-3 pr-2 text-left transition-colors hover:bg-accent",
          "marker:hidden [&::-webkit-details-marker]:hidden",
        )}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase text-muted-foreground">
          {props.account.fullName.slice(0, 2)}
        </span>
        <span className="hidden leading-tight sm:block">
          <span
            data-testid="viewer"
            className="block text-xs font-medium text-foreground"
          >
            {props.account.fullName}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {props.account.roleName}
          </span>
        </span>
        <span aria-hidden className="text-muted-foreground">
          &#9662;
        </span>
      </summary>

      <div
        data-testid="switch-account"
        className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-xl border border-border bg-popover p-1 shadow-lg"
      >
        <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Switch account
        </p>
        {accounts.map((candidate) => (
          <AccountEntry key={candidate.memberId} candidate={candidate} acting={props.account} />
        ))}
        <OrganizationGroup memberId={props.account.memberId} elsewhere={elsewhere} />
        <p className="border-t border-border/70 px-3 pb-1 pt-2 text-xs leading-snug text-muted-foreground">
          Switching keeps you on this page. Navigation is identical for both accounts; the
          restricted one simply receives fewer rows.
        </p>
      </div>
    </details>
  );
}

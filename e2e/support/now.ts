// **The instant the e2e suite pins the server to** (ticket 62).
//
// Every figure this suite asserts is read against `now`: the observation window is the declared
// window cut at it (R-D2), the period menu offers no month beyond the one it falls in, the
// History date inputs are bounded by its civil day, and — from ticket 66, when the committed
// fixture runs past today — the rows themselves are `datasetAsOf(now)`. Left to the wall clock,
// a suite that passes this morning fails tomorrow for no reason anybody changed.
//
// So the server is pinned. `playwright.config.ts` puts this value in the `webServer`'s
// environment as `AGENT_DASH_NOW`; `src/data/clock.ts` reads it in place of `Date.now()` and
// clamps it exactly as it clamps the wall clock. It is **server-side only** — it decides which
// rows exist, so a value a browser could set would be a way to ask for rows the server means to
// withhold — and it is set in no committed production config. On Vercel the variable is absent.
//
// **Midday UTC on the window's last declared day** is chosen rather than some pleasant instant
// mid-window: it is exactly where the clamp in `clock.ts` already lands the wall clock today, so
// pinning it changes nothing about what the suite reads and everything about whether it keeps
// reading it. In Europe/Madrid — the Organization's declared timezone (R-D1) — that is 14:00 on
// the same civil day.

/** ISO 8601, UTC. The instant `AGENT_DASH_NOW` carries into the server under test. */
export const PINNED_NOW = "2026-09-08T12:00:00Z";

/** The name of the server-side override. Written here once, read by the config and by a spec. */
export const PINNED_NOW_ENV = "AGENT_DASH_NOW";

/**
 * `PINNED_NOW` as the Organization reads it — `YYYY-MM-DD HH:MM`, the shape `instantIn` prints
 * and therefore the shape every rendered instant on the page is comparable to as text.
 */
export const pinnedNowIn = (timezone: string): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(PINNED_NOW))
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

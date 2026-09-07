// Shared ground for T-E3 and T-E4.
//
// The accounts and the signing come from the application's own modules rather than from a
// second copy here. A test that re-derives "which Member is the restricted account" can agree
// with itself while disagreeing with the product, and a test that re-implements signing stops
// proving that the server's verification accepts the server's own tokens.
//
// The cost search set is the deliberate exception and lives in `./costs`: what a test *allows*
// must not be decided by the code the test is checking. See that file's header.

import type { BrowserContext, Page } from "@playwright/test";
import { signInAccounts, type Account } from "../../src/data/accounts";
import { loadDataset } from "../../src/data/load";
import { SESSION_COOKIE } from "../../src/data/session-cookie";
import { issueSession } from "../../src/data/session";

/** R-A4 order: the open default first, the restricted contractor second. */
const [openAccount, restrictedAccount] = signInAccounts();

if (!openAccount || !restrictedAccount) throw new Error("R-A3: two seeded accounts expected");

export const OPEN_ACCOUNT: Account = openAccount;
export const RESTRICTED_ACCOUNT: Account = restrictedAccount;

/** Every `/[org]/**` route that exists today. Ticket 30 adds panels; the paths are these. */
export const orgRoutes = (slug: string): readonly string[] => [
  `/${slug}`,
  `/${slug}/spend`,
  `/${slug}/work`,
  `/${slug}/people`,
  `/${slug}/history`,
  `/${slug}/projection`,
];

/**
 * Installs a session cookie carrying arbitrary claims — including claims the application
 * would never mint, which is how the org-mismatch case of T-E3 is reachable at all.
 *
 * `secure: false` on the *browser* side only. The server always sets `Secure` (R-T13); this
 * writes straight into the cookie jar, where the attribute would only stop Playwright from
 * sending it over `http://localhost`.
 */
export const useSession = async (
  context: BrowserContext,
  claims: { member_id: string; org_slug: string },
  baseURL: string,
): Promise<void> => {
  const token = await issueSession(claims);
  await context.clearCookies();
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, url: baseURL, httpOnly: true, secure: false },
  ]);
};

const decodeEscapes = (body: string): string =>
  body
    .replaceAll(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replaceAll(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    );

/**
 * Everything the server sent for one route: the HTML document *and* the RSC flight payload.
 *
 * Both, because they are two different serialisations of the same tree and a figure can reach
 * the browser in either. The flight payload is the one a DOM query cannot see — a value passed
 * to a client component as a prop is in it whether or not anything renders it, which is
 * precisely the leak T-E4 exists to catch. Escapes are decoded so that a name carrying an
 * accent cannot hide behind `é`.
 */
export const payloadFor = async (page: Page, path: string): Promise<string> => {
  const document = await page.goto(path);
  const html = (await document?.text()) ?? "";
  const flight = await page.request.get(path, { headers: { RSC: "1" } });
  return decodeEscapes(html + (await flight.text()));
};

/** Full names of every Member the viewer holds no identifying scope over. */
export const ungrantedNames = (viewerMemberId: string): readonly string[] =>
  loadDataset()
    .members.filter((member) => member.id !== viewerMemberId)
    .map((member) => member.full_name);

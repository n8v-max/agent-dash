// The session token — issue and verify, and nothing above this line touches `jose`.
//
// **R-T14 — the payload is `{ member_id, org_slug }` and nothing else.** No grants, no scopes,
// no role name. A token carrying its own grants is a token that can be edited to widen them;
// grants are resolved server-side from the Member's Role in `viewer.ts`, every request.
//
// **The secret is read once, here, at module load.** `AUTH_JWT_SECRET` is server-side only and
// is never `NEXT_PUBLIC_`-prefixed — a signing key serialised to the browser forges tokens for
// anyone who opens devtools. Reading it at module load rather than at first sign-in means a
// keyless deployment fails at boot, where somebody is watching, instead of at the first
// visitor's sign-in, where nobody is.

import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS } from "./session-cookie";

/** HS256's key floor. A shorter key is weaker than the algorithm claims to be. */
const MINIMUM_SECRET_BYTES = 32;

/** The whole payload (R-T14). Snake-case because it is a wire shape, not an identifier. */
export type SessionClaims = {
  readonly member_id: string;
  readonly org_slug: string;
};

/**
 * `Uint8Array.from` re-wraps with *this* realm's constructor. `TextEncoder` in a jsdom test
 * environment returns Node's, and `jose` type-checks its key with `instanceof`, so the
 * unwrapped array is rejected as "not a Uint8Array" by a library holding a different one.
 */
const encode = (value: string): Uint8Array => Uint8Array.from(new TextEncoder().encode(value));

const readSecret = (): Uint8Array => {
  const secret = process.env.AUTH_JWT_SECRET ?? "";
  const key = encode(secret);
  if (key.byteLength < MINIMUM_SECRET_BYTES) {
    throw new Error(
      "AUTH_JWT_SECRET is missing or shorter than 32 bytes, which is HS256's minimum " +
        `(got ${String(key.byteLength)}). Set it in .env.local for dev, in the CI workflow, ` +
        "and in the Vercel dashboard for production. Generate one with: openssl rand -base64 32",
    );
  }
  return key;
};

const SECRET = readSecret();

/** Pinned, so a token presenting `alg: none` or a different family is never even considered. */
const ALGORITHM = "HS256";

/** Signs one account's claims. The only place a session token is minted. */
export const issueSession = async (claims: SessionClaims): Promise<string> =>
  new SignJWT({ member_id: claims.member_id, org_slug: claims.org_slug })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${String(SESSION_TTL_SECONDS)}s`)
    .sign(SECRET);

const claimsOf = (payload: Record<string, unknown>): SessionClaims | undefined => {
  const memberId = payload.member_id;
  const orgSlug = payload.org_slug;
  if (typeof memberId !== "string" || typeof orgSlug !== "string") return undefined;
  return { member_id: memberId, org_slug: orgSlug };
};

/**
 * Verifies a token and returns its claims, or `undefined` for anything at all wrong — absent,
 * malformed, expired, signed with another key, or shaped differently. One `undefined` rather
 * than a reason, because every reason has the same consequence and a caller that can tell them
 * apart is a caller that can leak which one it was.
 */
export const readSession = async (
  token: string | undefined,
): Promise<SessionClaims | undefined> => {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALGORITHM] });
    return claimsOf(payload);
  } catch {
    return undefined;
  }
};

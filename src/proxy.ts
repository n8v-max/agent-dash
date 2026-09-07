// R-T4 / R-T15 step 1 — the optimistic check, and **explicitly not the authorization
// boundary**. The Next 16 docs are direct about it: Proxy "should not be used as a full
// session management or authorization solution", and it runs on prefetches too, so it reads
// the cookie's *presence* and nothing more. It does not verify the signature, does not read
// the fixture, and cannot decide what a viewer may see.
//
// The gate is `src/app/[org]/layout.tsx` (R-T15 step 2). Deleting this file would cost a
// courtesy redirect and would not open a single row.
//
// Next 16 renamed `middleware.ts` to `proxy.ts`. Same functionality, new file name and export.

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/data/session-cookie";

/** Routes that exist for a visitor holding no session. Everything else is an `[org]` path. */
const PUBLIC_PATHS: ReadonlySet<string> = new Set(["/", "/sign-in"]);

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.nextUrl));
}

export const config = {
  // `/[org]` is a top-level dynamic segment, so the matcher subtracts what is not an org path
  // rather than listing the orgs — there is no list of orgs to write (R-A1). `api` is excluded
  // because `/api/session` is how a visitor with no cookie *gets* one.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]*$).*)"],
};

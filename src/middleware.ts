import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic redirect for signed-out users. This is NOT authorization: every page and action
 * validates the session and permissions on the server.
 */
export function middleware(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };

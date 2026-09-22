// Site-wide family password gate. Runs on Vercel's Edge runtime, in
// front of every request except the login page and the login API
// itself. No valid session cookie -> redirect to /login.html.
//
// Fails CLOSED: if FAMILY_SITE_PASSWORD isn't set yet, no session can
// ever verify as valid, so the whole site simply stays behind the
// login page (which will show a clear "not configured" error from
// /api/auth) rather than accidentally being served publicly.

import { SESSION_COOKIE, verifySessionToken, parseCookie } from "./lib/session.js";

export const config = {
  matcher: ["/((?!api/auth|login.html|robots.txt|_vercel).*)"],
};

export default async function middleware(request) {
  const secret = process.env.FAMILY_SITE_PASSWORD || "";
  const cookieHeader = request.headers.get("cookie");
  const token = parseCookie(cookieHeader, SESSION_COOKIE);
  const valid = secret && (await verifySessionToken(token, secret));
  if (valid) return;

  const url = new URL("/login.html", request.url);
  return Response.redirect(url, 302);
}

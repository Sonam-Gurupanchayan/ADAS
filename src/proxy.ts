import { NextResponse, type NextRequest } from "next/server";

// Coarse, cookie-presence gate so unauthenticated visitors are bounced to the right
// sign-in page without rendering anything. Real authorization happens in every page,
// server action and route handler (lib/guards.ts).
//
// /api is deliberately excluded: the proxy buffers request bodies, which would break
// streaming firmware uploads. Route handlers do their own checks.

const OIDC_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const has = (name: string) => req.cookies.getAll().some((c) => c.name === name || c.name.startsWith(`${name}.`));

  if (pathname.startsWith("/portal") || pathname.startsWith("/admin")) {
    if (pathname.startsWith("/portal/signin")) return NextResponse.next();
    if (!OIDC_COOKIES.some(has)) {
      const url = new URL("/portal/signin", req.url);
      url.searchParams.set("callbackUrl", pathname + search);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Sensor app: everything else except its public pages.
  if (pathname === "/login" || pathname === "/enroll") return NextResponse.next();
  if (!has("sensor_session")) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icons|sw.js|manifest.webmanifest|favicon.ico).*)"],
};

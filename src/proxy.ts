import { NextResponse, type NextRequest } from "next/server";
import { adminCsp, siteCsp } from "@/lib/csp";
import { serverEnv, ServerConfigError, type ServerEnv } from "@/lib/server/env";
import { requestHost } from "@/lib/server/rateLimit";
import { openSession, sessionCookieName } from "@/lib/server/session";

/**
 * Runs before every page render:
 * 1. Host binding: the admin console answers only on ADMIN_URL's host. In a
 *    split deployment (SITE_URL on a different host) the admin host serves
 *    nothing but the admin, so student-side third-party scripts never share
 *    its origin.
 * 2. Optimistic sign-in redirect for /admin. A convenience only - every admin
 *    page and API verifies the session again on the server.
 * 3. A fresh CSP nonce per request (Next.js applies it to its own scripts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  let env: ServerEnv | null = null;
  try {
    env = serverEnv();
  } catch (error) {
    if (!(error instanceof ServerConfigError)) throw error;
    // A misconfigured admin fails closed without taking the public site down
    if (isAdmin) {
      console.error(error.message);
      return new NextResponse("Admin is not configured on this server.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  }

  if (env) {
    const onAdminHost = requestHost(request.headers, env.trustedProxyHops) === env.adminHost;
    if (isAdmin && !onAdminHost) {
      return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (!isAdmin && onAdminHost && env.siteHost) {
      // Dedicated admin host: send anything else to the admin console
      return NextResponse.redirect(new URL("/admin", env.adminOrigin));
    }
    if (isAdmin && pathname !== "/admin/login") {
      const token = request.cookies.get(sessionCookieName(env.isProduction))?.value;
      if (!openSession(env.sessionSecret, token)) {
        return NextResponse.redirect(new URL("/admin/login", env.adminOrigin));
      }
    }
  }

  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const host = request.nextUrl.hostname;
  const upgradeInsecure = !isDev && host !== "localhost" && host !== "127.0.0.1";
  const csp = isAdmin
    ? adminCsp({ nonce, isDev, upgradeInsecure })
    : siteCsp({
        nonce,
        isDev,
        upgradeInsecure,
        apiOrigin: new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").origin,
        firebaseAuthDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
        userbackEnabled: Boolean(process.env.NEXT_PUBLIC_USERBACK_TOKEN),
        authEmulatorOrigin: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST
          ? `http://${process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST}`
          : undefined,
      });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, build assets and public files
      source:
        "/((?!api|_next/static|_next/image|favicon|android-chrome|apple-touch|mstile|images/|avatars/|site.webmanifest|browserconfig.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

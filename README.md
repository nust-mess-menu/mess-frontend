# mess-frontend

Next.js 16 frontend for the NUST mess menu, in two parts:

- **Student site** (`/`, `/daily`, `/weekly`): the original UI, ported pixel for pixel. Today's menu, the weekly menu, Google sign-in, 1–10 ratings with anonymous reviews, and upvotes.
- **Admin console** (`/admin`): a redesigned menu-management UI on a hardened backend-for-frontend.

It talks to [`mess-backend`](https://github.com/nust-mess-menu/mess-backend).

```
 student browser ──(Firebase ID token)──────────────────────────► mess-backend ──► Firestore
 admin browser ──(encrypted HttpOnly cookie)──► this app /api/admin/* ──(server-held Basic auth)──┘
```

## Quick start

```bash
cp .env.example .env.local      # fill in values
npm ci
npm run dev                     # http://localhost:3000  (mess-backend on :8080)
npm run validate                # typecheck + lint + unit tests + production build
```

## Configuration

`NEXT_PUBLIC_*` values are compiled into the browser bundle, so never put secrets in them. Everything else is server-only. Every server module imports `server-only`, so importing one from client code fails the build.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | mess-backend origin that browsers call. The backend's `FRONTEND_URL` must include the **student site** origin. |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config. It's public by design: access is enforced by Firebase Auth and the backend. |
| `NEXT_PUBLIC_USERBACK_TOKEN` | Feedback widget. Leave it empty to turn the widget off. |
| `ADMIN_URL` | **Required.** Origin the admin console is served from. Admin pages and APIs answer *only* on this host. |
| `SITE_URL` | Optional, **recommended**. Student-site origin when the admin has its own subdomain (see below). |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | What admins type at `/admin/login`. |
| `BACKEND_ADMIN_USERNAME` / `BACKEND_ADMIN_PASSWORD` | mess-backend's admin credentials, used only from server to server. |
| `SESSION_SECRET` | Key for the session cookie. ≥ 32 characters. Rotating it signs out every admin. |
| `TRUSTED_PROXY_HOPS` | **Required in production.** `1` on Vercel or behind one load balancer; `0` if the app is exposed directly. |

In production the server refuses admin traffic if anything is weak or missing:
- passwords under 16 characters, or repetitive ones;
- a session secret under 32 characters;
- an http origin (except loopback).

The public site keeps working either way. Quote any value that contains `#` (`KEY='a#b'`), otherwise `.env` parsing treats the rest of the value as a comment.

### Recommended production layout

Serve the admin from its own subdomain, for example `ADMIN_URL=https://admin.mess.example.edu` and `SITE_URL=https://mess.example.edu`, with both domains pointed at this app.

The admin host then serves only the admin, and the student host returns 404 for every admin path. Third-party scripts on the student site (feedback widget, Firebase, analytics) can never run on the admin's origin. Its `__Host-` cookie is never sent to the student host, and the admin API rejects requests from the student host's origin.

## Security model

**Admin console**
- **Sign-in:** happens on this server. The browser holds only an AES-256-GCM encrypted, HttpOnly, `Secure`, `SameSite=Strict` `__Host-` cookie that contains no credentials.
- **Session lifetime:** 8 hours absolute and 30 minutes idle (sliding). Sign-out revokes the session on the server.
- **Backend credentials:** live only in server env. Route handlers reach mess-backend through a fixed allowlist of paths. Redirects are refused, so credentials can't be replayed to another host. Backend errors are reduced to plain messages.
- **CSRF:** every mutation must carry the admin origin and `Sec-Fetch-Site: same-origin`. Bodies must be JSON and are size-capped while the stream is read. Input is validated with zod, and only known fields are forwarded.
- **Brute force:**
  - per client IP: 5 attempts per 15 minutes, with attempts counted before any `await`, so parallel bursts can't get past the limit;
  - site-wide: a slowdown that grows with recent failures, never a lock the attacker could turn on the real admin;
  - an in-flight cap on concurrent sign-in attempts;
  - long, non-repetitive passwords required.
- **Pages:** checked on the server. The proxy redirect is only a convenience. Admin pages load no Bootstrap, analytics or third-party code.

**Whole app**
- **CSP:** a fresh nonce per request plus `'strict-dynamic'`, so no inline or injected script runs. The admin CSP allows no third-party origins at all. Other directives: `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`.
- **Headers:** HSTS (preload), `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy, a locked-down `Permissions-Policy`, `COOP: same-origin-allow-popups` (needed for the Google sign-in popup) and CORP. `X-Powered-By` is off. `/admin` and `/api` are `no-store` and `noindex`.
- **User content:** rendered as text only. There is no `dangerouslySetInnerHTML`. Profile photos must be https and load with `no-referrer`. Reviewers appear only under generated usernames.
- **Shared computers:** cached menus, which include the user's own ratings, are cleared on sign-in, sign-out and session expiry.
- **Dependencies:** Bootstrap is bundled locally instead of loaded from a CDN, so there's no third-party CSS or JS supply chain. Only the Firebase `app` and `auth` packages are installed. `npm audit --omit=dev` reports 0 vulnerabilities.
- **Testing hook:** the Firebase Auth emulator setting is used only for local tests, and a production build pointed at a real API refuses to start with it set.

Known limits:
- Sign-in throttling and session revocation are per server instance, held in memory. Use a shared store such as Redis or Vercel KV if you run many instances and want those limits applied globally.
- `style-src` allows `'unsafe-inline'`, because React's server-rendered `style=""` attributes can't be covered by a nonce. Inline styles can't execute code.

## Caching

| What | Policy |
|---|---|
| HTML pages | `no-store`. Every page carries a per-request CSP nonce, so it must never be reused. |
| `/_next/static/*` (JS, CSS, fonts) | Content-hashed, `immutable`. |
| Public files (icons, avatars, images) | `public, max-age=86400, stale-while-revalidate=604800`. |
| Menus in the browser | localStorage stale-while-revalidate, using the same keys as the original app. Under 60 s old it's served with no request. Up to 1 hour (same day) it's painted instantly and refreshed in the background, and a failed refresh keeps the cached menu instead of showing an error. Older than that it's refetched. |
| After a rating | The menu is patched in place, in memory and in localStorage, with the exact totals returned by the server's write. There's no refetch, which could land on a backend instance whose cache is a few seconds behind. |
| Reviews | Never cached locally. They're refetched each time a meal's reviews are opened. |
| Admin console and `/api/admin/*` | `no-store`. The backend serves admin reads fresh, bypassing its caches. |
| Sign-in / sign-out | Cached menus are cleared, because they contain the previous user's own ratings. |

Combined with the backend (CDN ≤ 60 s, memory ≤ 60 s), an admin's edit reaches every student within about 2 minutes, and immediately for anyone without a cached copy.

## Tests

```bash
npm test                        # unit: session crypto, limiter, env, CSP, every admin route handler
```

End-to-end tests run against a real stack: Firebase emulators in Docker, then mess-backend, then this app's production build. Google sign-in goes through the Auth emulator's account picker, and every test fails on any CSP violation or page error.

```bash
npm run e2e:emulators           # Firestore + Auth emulators in Docker (no Google account needed)
(cd ../mess-backend && npm ci && npm run build)
npm run e2e:reset               # wipe emulators, (re)start mess-backend, seed the real menu
npm run e2e:build && npm run e2e:start &
npm run test:e2e                # Playwright, using the locally installed Chrome
```

## Deploy

**Vercel:** set the env vars above (`TRUSTED_PROXY_HOPS=1`). Vercel Analytics turns on automatically there.

**Docker:**

```bash
docker build -t mess-frontend \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.edu \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... (each NEXT_PUBLIC_* value) .
docker run -p 3000:3000 --read-only --tmpfs /app/.next/cache --tmpfs /tmp --cap-drop ALL \
  -e ADMIN_URL=... -e ADMIN_USERNAME=... -e ADMIN_PASSWORD=... \
  -e BACKEND_URL=... -e BACKEND_ADMIN_USERNAME=... -e BACKEND_ADMIN_PASSWORD=... \
  -e SESSION_SECRET=... -e TRUSTED_PROXY_HOPS=1 mess-frontend
```

The image runs as a non-root user, the app files are root-owned and read-only, and it includes a healthcheck.

## Layout

```
src/proxy.ts                 CSP nonce, host binding, admin sign-in redirect
src/app/(site)/              student pages (root layout #1: Bootstrap + original CSS)
src/app/(admin)/admin/       admin pages   (root layout #2: admin CSS only)
src/app/api/admin/           backend-for-frontend route handlers
src/lib/server/              env, session crypto, rate limiting, backend client (server-only)
src/lib/site/                Redux store, Firebase auth, API client for the student site
src/components/site|admin/   UI
src/styles/                  original CSS (unchanged), vendored Bootstrap 5.3.0-alpha1, admin CSS
test/  e2e/                  unit and end-to-end tests
```

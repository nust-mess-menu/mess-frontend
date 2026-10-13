# Deploying the frontend to Cloudflare Workers

The frontend runs on Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`):

- **Student site:** `https://mess-menu.taaha.dev`
- **Admin console:** `https://mess-menu-admin.taaha.dev`. It has its own host, so student-side
  scripts never share the admin's origin.
- **Backend:** `https://mess-menu-backend.taaha.dev` (Heroku)

The free Workers plan allows 100,000 requests a day. Beyond that, requests fail until
the next day; there's never a bill. Static assets (`/_next/static`, icons) are served
from Cloudflare's CDN and don't count as Worker requests.

## Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Worker name, custom domains, and non-secret runtime vars (`ADMIN_URL`, `SITE_URL`, `BACKEND_URL`, `TRUSTED_PROXY_HOPS=cloudflare`, `NODE_ENV`). |
| `open-next.config.ts` | Adapter config. There's no incremental cache, because every page is rendered per request for the CSP nonce. |
| `.env.production` | Public `NEXT_PUBLIC_*` build values, including the production API URL. Never put secrets here. |
| `scripts/cf-build.sh` | Builds with `.env.local` moved aside. OpenNext embeds every `.env*` file into the worker, and this keeps local credentials out of it. |
| `public/_headers` | Cache and security headers for static assets, which the CDN serves without running the worker. |
| `patches/` | A `patch-package` fix so OpenNext 1.20.10 inlines Next 16.4's `preview-props.json`. Drop it once OpenNext ships the fix. |

## First-time setup

```bash
npx wrangler login                     # once, in the browser
# Secrets (never committed); each command prompts for its value:
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD           # >= 16 chars
npx wrangler secret put BACKEND_ADMIN_USERNAME   # = mess-backend ADMIN_USERNAME
npx wrangler secret put BACKEND_ADMIN_PASSWORD   # = mess-backend ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET           # openssl rand -base64 48
```

On the backend, allow the site origin (already done):

```bash
heroku config:set FRONTEND_URL=https://mess-menu.taaha.dev,... -a nust-mess-backend
```

## Deploy

```bash
npm run cf:deploy
```

The first deploy creates both custom domains and their DNS records and certificates on
the `taaha.dev` zone automatically.

## Local preview on the Workers runtime

```bash
# .dev.vars (gitignored) holds the secrets plus local overrides:
#   ADMIN_URL=http://localhost:8787  SITE_URL=  BACKEND_URL=...
npm run cf:build
npx wrangler dev --local --port 8787 --host localhost:8787
```

The `--host` flag matters. Without it, wrangler dev rewrites the Host header to the first
custom domain, and the admin console returns 404 locally.

## Workers-specific notes

- **Client IP and Host:** with `TRUSTED_PROXY_HOPS=cloudflare`, the client IP comes from
  `CF-Connecting-IP`, which the edge sets and clients can't forge. Host is taken as
  Cloudflare routed it.
- **`NODE_ENV=production`** is set as a var. Next doesn't inline it into the Node
  middleware bundle on Workers, and without it the proxy would look for the dev cookie name.
- **Backend fetch:** uses `redirect: "manual"` and refuses any 3xx, because Workers
  rejects `redirect: "error"`.
- **Server-rendered dates** use `timeZone: "Asia/Karachi"`. Workers run in UTC, so
  without it the server and browser renders would disagree.
- **Per-instance memory:** sign-in throttling and session revocation live in memory per
  Worker instance. That's fine for one admin. Move them to Workers KV if that changes.

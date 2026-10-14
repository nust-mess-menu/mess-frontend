# Deploying the frontend to Cloudflare Workers

The frontend runs on Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`):

- **Student site:** `https://nustmessmenu.oddmancy.com` (old addresses `eat.oddmancy.com` and `eat.taaha.dev` permanently redirect here, via the tiny `redirect/` worker)
- **Admin console:** `https://nustmessmenu-admin.oddmancy.com`. It has its own host, so student-side
  scripts never share the admin's origin.
- **Backend:** `https://eat-api.oddmancy.com` (Heroku)

**Two deployments, because the free plan allows only 10 ms of CPU per Worker request**
(server-rendering a Next.js page takes more, which showed up as Error 1102):

| Host | What | Config |
|---|---|---|
| `nustmessmenu.oddmancy.com` | Student site as **static files** (no Worker runs, no CPU limit, no request quota) | `site/wrangler.jsonc` |
| `nustmessmenu-admin.oddmancy.com` | Admin console + admin API (OpenNext Worker) | `wrangler.jsonc` |

Student pages are prerendered at build time. Their CSP can't use a per-request
nonce, so `scripts/build-static-site.mjs` hashes every inline script in the built
pages and writes the policy, plus the security and cache headers, to `_headers`.
Keep student pages static: the build fails if one turns dynamic or carries a nonce.
The admin is still server-rendered and subject to the 10 ms limit, but only admins use it.

## Files

| File | Purpose |
|---|---|
| `site/wrangler.jsonc` | The static student site (assets only, 404 page, custom domain). |
| `scripts/build-static-site.mjs` | Assembles `.static-site/`: prerendered pages, assets, hash-based CSP `_headers`. |
| `wrangler.jsonc` | Admin Worker name, custom domain, and non-secret runtime vars (`ADMIN_URL`, `SITE_URL`, `BACKEND_URL`, `TRUSTED_PROXY_HOPS=cloudflare`, `NODE_ENV`). |
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
heroku config:set FRONTEND_URL=https://nustmessmenu.oddmancy.com,... -a nust-mess-backend
```

## Deploy

```bash
npm run cf:deploy
```

The first deploy creates both custom domains and their DNS records and certificates on
the `oddmancy.com` zone automatically.

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

## Old address redirect

`redirect/` is a separate, 15-line Worker (`nustmessmenu-redirect`) that owns `eat.taaha.dev` and
`eat.oddmancy.com` and answers every request with a 301 to the same path on
`nustmessmenu.oddmancy.com`. Deploy it with
`cd redirect && npx wrangler deploy`.

## Outside Cloudflare, per domain

- **Firebase Console** → Authentication → Settings → Authorized domains: add the
  site domain, or Google sign-in fails with `auth/unauthorized-domain`.
- **Userback** → Site settings → Domains: add the site domain, or the report widget won't load.

#!/usr/bin/env bash
# Build for Cloudflare Workers.
#
# OpenNext embeds every .env* file it finds into the worker bundle, so
# .env.local (local admin credentials, localhost URLs) is moved aside for the
# build. Public values come from .env.production; server settings and secrets
# come from wrangler.jsonc vars and `wrangler secret put`.
set -euo pipefail
cd "$(dirname "$0")/.."

moved=()
for f in .env .env.local .env.production.local; do
  if [[ -f "$f" ]]; then mv "$f" "$f.cf-build-bak"; moved+=("$f"); fi
done
restore() { for f in "${moved[@]:-}"; do [[ -n "$f" ]] && mv "$f.cf-build-bak" "$f"; done; }
trap restore EXIT

# The menu baked into the student pages (src/lib/site/menuSnapshot.ts) must be
# fetched fresh: Next.js would otherwise reuse a response from an earlier build
rm -rf .next/cache/fetch-cache

npx opennextjs-cloudflare build
# Student pages as plain static files (site/wrangler.jsonc)
node --no-warnings --env-file=.env.production scripts/build-static-site.mjs

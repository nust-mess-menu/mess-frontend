#!/usr/bin/env bash
# Reset the local E2E stack to a known state:
#   wipe the Firestore + Auth emulators, restart mess-backend (drops its
#   in-memory caches), and seed the real two-week menu through the admin API.
#
# Expects: emulators on 127.0.0.1:8085 / :9099 (npm run e2e:emulators) and
# mess-backend checked out next to this repo and built (npm run build there).
# Seeds e2e/menu-seed.json - the real two-week menu.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${BACKEND_DIR:-$HERE/../../mess-backend}"
MENU_SEED="${MENU_SEED:-$HERE/menu-seed.json}"
LOG="${E2E_BACKEND_LOG:-/tmp/mess-backend-e2e.log}"
ADMIN_USER="menuadmin"
ADMIN_PASS='Xk9#v2:LqPz7!wR4tYb'

curl -sf -X DELETE "http://127.0.0.1:8085/emulator/v1/projects/demo-mess/databases/(default)/documents" >/dev/null
curl -sf -X DELETE "http://127.0.0.1:9099/emulator/v1/projects/demo-mess/accounts" >/dev/null

pkill -f "node dist/server.js" 2>/dev/null || true
sleep 1
(
  cd "$BACKEND_DIR"
  env -i PATH="$PATH" HOME="$HOME" NODE_ENV=development PORT=8080 HOST=127.0.0.1 \
    FIREBASE_PROJECT_ID=demo-mess GCLOUD_PROJECT=demo-mess \
    FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
    ADMIN_USERNAME="$ADMIN_USER" ADMIN_PASSWORD="$ADMIN_PASS" \
    CRON_SECRET=0123456789abcdef0123456789abcdef01 COMMENT_ID_SALT=a-real-salt-value-123 LOG_LEVEL=warn \
    nohup node dist/server.js >"$LOG" 2>&1 &
)
for _ in $(seq 1 30); do curl -sf http://127.0.0.1:8080/health >/dev/null && break; sleep 0.5; done

curl -sf -u "$ADMIN_USER:$ADMIN_PASS" -H 'Content-Type: application/json' \
  --data-binary @"$MENU_SEED" http://127.0.0.1:8080/api/admin/menu/bulk
echo

# DDoS protection

The backend (`mess-backend`) runs on Heroku at `https://eat-api.oddmancy.com`
(app `nust-mess-backend`, one Basic dyno: always on, flat $7/month). The frontend
runs on Cloudflare Workers (free plan) at `https://nustmessmenu.oddmancy.com`.

## What the backend already does

- Heroku bills a flat rate per dyno, never per request. A flood can slow the API
  down but cannot run up a bill.
- Menus are served from memory for 60 s, so a flood of menu reads barely touches
  Firestore.
- Rate limits per IP on every request, with tighter limits for sign-in, ratings,
  upvotes and the admin API. Request bodies are size-capped.
- Check-ins (usage stats) are also capped across all users together at
  1,000/minute and 30,000/day, so fake visitor IDs sent from many IPs cannot run up
  Firestore writes.
- `ORIGIN_SECRET` origin lock: once it's set, every request without the right
  `X-Origin-Secret` header gets a 403 before any work is done.

Application code cannot absorb a real volumetric attack, because a flood fills
the single dyno first. Cloudflare has to sit in front of the backend, and the
origin lock stops attackers going around Cloudflare to the `herokuapp.com` hostname.

## Backend: Cloudflare in front of Heroku

`oddmancy.com` is on Cloudflare. Do these steps in order.

1. **Turn on the proxy.** DNS: set `eat-api` (CNAME to the Heroku DNS
   target) to **Proxied** (orange cloud). SSL/TLS: set the mode to **Full (strict)**.
2. **Make a secret.** Run `openssl rand -hex 32` locally.
3. **Have Cloudflare send the secret.** Rules → Transform Rules → *Modify Request Header*.
   Match hostname equals `eat-api.oddmancy.com`, then **Set static** header
   `X-Origin-Secret` to the secret.
4. **Turn on the lock in Heroku.**
   ```bash
   heroku config:set ORIGIN_SECRET=<the secret> TRUST_PROXY=2 -a nust-mess-backend
   ```
   `TRUST_PROXY=2` is required. Without it the backend would see Cloudflare's IP
   as every visitor's IP, and everyone would share one rate limit. After this
   step, direct requests to the `herokuapp.com` address get a 403.
   **Only do this after steps 1 and 3 are saved**, or real users get 403s too.
5. **Add a Cloudflare rate limit.** Security → WAF → Rate limiting rule. For
   example: path starts with `/api/`, more than 100 requests per 10 seconds per
   IP → block. The free plan includes one rule.
6. **During an attack,** turn on Security → **Under Attack mode**.

Check that it works:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://eat-api.oddmancy.com/health                    # 200
curl -s -o /dev/null -w "%{http_code}\n" https://nust-mess-backend-7ba5d40f1820.herokuapp.com/health    # 403
```

To rotate the secret, change the Cloudflare header first and then
`ORIGIN_SECRET`. Requests fail for the few seconds between the two changes.

## Frontend: Cloudflare Workers

The free plan has a hard cap of 100,000 requests a day. An attack beyond that makes the
site answer with errors until the next day, and never produces a bill. Static assets
come from Cloudflare's CDN and don't count. During an attack, turn on Under Attack mode
for `oddmancy.com`.

## Other operations notes

- **Weekly menu switch:** point a scheduler (an external cron, or Heroku Scheduler
  with `heroku addons:create scheduler:standard -a nust-mess-backend`) at
  `POST https://eat-api.oddmancy.com/api/cron/switch-week` with the header
  `Authorization: Bearer $CRON_SECRET`.
- **Allowed frontends:** the backend only accepts browser calls from the origins
  in `FRONTEND_URL`. Add the frontend's domain there:
  `heroku config:set FRONTEND_URL=https://a,https://b -a nust-mess-backend`.
- **Stats markers:** in the Firebase console, add a Firestore TTL policy on
  `statsVisitors.expireAt` so per-visitor markers delete themselves.

# 🚀 NineSpoof Bot - Deploy Guide (Keep Alive Permanently)

## Why 502 on E2B URL?
E2B sandbox URL `https://5000-xxx.e2b.app` is **secured with token** and **temporary (2-3 hours)**. It requires header `e2b-traffic-access-token` which only Arena's LIVE PREVIEW adds. External ping (UptimeRobot, browser direct) will always show `403` or `502 Sandbox not found`. This is NOT for production.

For 24/7 keep-alive, deploy to a real host (free tiers below).

---

## Option 1: Render.com (Easiest, Free)

1. Push this folder to GitHub (already has Dockerfile + render.yaml)
2. Go to https://dashboard.render.com → New Web Service → Connect GitHub repo
3. Render auto-detects `render.yaml`:
   - Build: `docker`
   - Health check: `/api/health`
4. Add Environment Variables in Render Dashboard (**DO NOT commit these — set via Render > Environment > Add**):
   ```
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ffspoof?appName=Cluster0
   DATABASE_URL=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ffspoof?appName=Cluster0
   TELEGRAM_BOT_TOKEN=<your_bot_token_from_BotFather>
   ADMIN_TELEGRAM_ID=6498333937
   PORT=10000
   ```
   > Get `MONGODB_URI` from MongoDB Atlas → Connect → Drivers → Node.js → Copy SRV string
   > Get `TELEGRAM_BOT_TOKEN` from @BotFather → /newbot → copy token

5. Deploy → You get public URL like `https://ninespoof-bot.onrender.com`
6. **Pin this URL:** `https://ninespoof-bot.onrender.com/api/ping` → Add to UptimeRobot (5 min interval)

Render free sleeps after 15 min idle — UptimeRobot ping every 5 min to keep awake. **This repo also has auto self-ping every 30s** (detects `RENDER_EXTERNAL_URL` automatically, no extra config needed).

---

## Option 2: Railway.app (Free $5 credit)

1. https://railway.app → New Project → Deploy from GitHub
2. Add same Variables as above (via Railway > Variables)
3. Railway gives URL `https://ninespoof-bot.up.railway.app` → Pin `/api/ping`

---

## Option 3: Fly.io (Near Mumbai - Fast)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
fly auth login
fly launch --no-deploy  # uses existing fly.toml (region sin)
fly secrets set MONGODB_URI="mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/ffspoof" TELEGRAM_BOT_TOKEN="<token>" ADMIN_TELEGRAM_ID="6498333937"
fly deploy
fly status  # get URL e.g. https://ninespoof-bot.fly.dev
```
Pin: `https://ninespoof-bot.fly.dev/api/ping`

---

## Option 4: Replit (Original Stack)

1. Import GitHub repo to Replit
2. Replit auto-uses `nodejs-24` modules, set `MONGODB_URI` in Secrets tab
3. Click Run → Replit gives URL → Pin `/api/ping`
4. Enable **Always On** (paid) or use UptimeRobot every 5 min

---

## After Deploy - Verify

```bash
curl https://YOUR-URL/api/ping | jq
# Should return: {"status":"ok","alive":true,"bot_status":"alive","bot_username":"NineSpoof_Bot",...}

curl https://YOUR-URL/api/health
# {"status":"ok","service":"ninespoof-api","alive":true}

curl https://YOUR-URL/api/cron
# OK (for cron-job.org)

# Check bot: Telegram → @NineSpoof_Bot → /start → Should reply instantly
```

---

## Environment Variables Reference

| Key | Required | Example |
|-----|----------|---------|
| `MONGODB_URI` | ✅ Yes | `mongodb+srv://user:pass@cluster.mongodb.net/ffspoof` |
| `DATABASE_URL` | ✅ Yes (same as MONGODB_URI) | same as above |
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | `8965913815:AAG...` |
| `ADMIN_TELEGRAM_ID` | Optional | `6498333937` |
| `PORT` | Auto (Render sets 10000) | `10000` |
| `NODE_ENV` | Optional | `production` |
| `PUBLIC_URL` | Optional (auto-detected on Render) | `https://your-app.onrender.com` |
| `SELF_PING_INTERVAL_MS` | Optional | `30000` |

> ⚠️ **NEVER commit `.env` or real tokens to GitHub** — always use Dashboard > Environment or `fly secrets set`

## Health Endpoints for cron-job.org

- `GET /api/ping` — full check (Telegram + uptime) → cron every 5 min
- `GET /api/health` — lightweight → cron every 1 min
- `GET /api/cron` — ultra-light `OK` text + supports HEAD → cron-job.org recommended

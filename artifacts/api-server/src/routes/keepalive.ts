import { Router, type IRouter } from "express";
const router: IRouter = Router();

// Main keepalive - use this URL to ping to keep bot alive
router.get("/ping", async (_req, res) => {
  const start = Date.now();
  let botStatus = "unknown";
  let botUsername: string | undefined;
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json() as any;
      if (data.ok) {
        botStatus = "alive";
        botUsername = data.result.username;
      } else {
        botStatus = "telegram_api_error";
      }
    } else {
      botStatus = "no_token";
    }
  } catch {
    botStatus = "telegram_unreachable";
  }

  res.json({
    status: "ok",
    alive: true,
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    bot_status: botStatus,
    bot_username: botUsername || "unknown",
    admin_id: process.env.ADMIN_TELEGRAM_ID || "6498333937",
    response_time_ms: Date.now() - start,
    message: "Bot is alive! Pin this URL or add to UptimeRobot to keep alive. Ping every 5 min recommended."
  });
});

// UptimeRobot expects 200 OK - this is simplest
router.get("/keepalive", async (_req, res) => {
  res.json({ status: "ok", alive: true, timestamp: new Date().toISOString(), uptime: process.uptime() });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ninespoof-api", alive: true });
});

export default router;

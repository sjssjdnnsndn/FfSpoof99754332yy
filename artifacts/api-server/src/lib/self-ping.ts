import { logger } from "./logger";

/**
 * Detects public URL automatically on Render / Railway / Fly / VPS
 * Priority:
 * 1. PUBLIC_URL env (manual override)
 * 2. RENDER_EXTERNAL_URL (Render provides: https://xxx.onrender.com)
 * 3. RENDER_EXTERNAL_HOSTNAME -> https://hostname
 * 4. RAILWAY_PUBLIC_DOMAIN -> https://domain
 * 5. FLY_APP_NAME -> https://app.fly.dev
 * 6. If none, skip self-ping (log warning)
 */
function detectPublicUrl(): string | null {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (process.env.FLY_APP_NAME) return `https://${process.env.FLY_APP_NAME}.fly.dev`;
  // Fallback: if KOYEB, VERCEL, etc.
  if (process.env.KOYEB_PUBLIC_DOMAIN) return `https://${process.env.KOYEB_PUBLIC_DOMAIN}`;
  return null;
}

export function startSelfPing(): void {
  // Disable in local dev if no public URL
  const publicUrl = detectPublicUrl();
  const intervalMs = Number(process.env.SELF_PING_INTERVAL_MS || 30000); // 30 sec

  if (!publicUrl) {
    logger.info("🔕 Self-ping disabled — no PUBLIC_URL / RENDER_EXTERNAL_URL detected (local dev). Set PUBLIC_URL to enable.");
    return;
  }

  const pingPath = process.env.SELF_PING_PATH || "/api/ping";
  const pingUrl = `${publicUrl}${pingPath}`;

  logger.info({ publicUrl, pingUrl, intervalMs }, "🔁 Self-ping enabled — will ping every 30s to keep alive + detect public URL");

  // Immediate first ping after 10s (let server fully start)
  setTimeout(() => doPing(pingUrl), 10000);

  setInterval(() => doPing(pingUrl), intervalMs);
}

async function doPing(url: string): Promise<void> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const ms = Date.now() - start;
    if (res.ok) {
      logger.info({ url, status: res.status, ms }, "✅ Self-ping OK");
    } else {
      logger.warn({ url, status: res.status, ms }, "⚠️ Self-ping non-200");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ url, error: msg }, "❌ Self-ping failed");
  }
}

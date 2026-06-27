/**
 * lib/alerts.ts
 * Best-effort Discord alerting. No new npm dependencies — uses native fetch.
 *
 * Alerts are a no-op (and never throw) when DISCORD_WEBHOOK_URL is unset, so
 * they are always safe to call from a request path.
 *
 * Env vars:
 *   DISCORD_WEBHOOK_URL   — Discord channel webhook to post alerts to (optional)
 *   LOW_STOCK_THRESHOLD   — quantity at/below which to warn (optional, default 5)
 */

function webhookUrl(): string {
  return (process.env.DISCORD_WEBHOOK_URL || "").trim();
}

function lowStockThreshold(): number {
  const n = Number((process.env.LOW_STOCK_THRESHOLD || "").trim());
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/**
 * Post a plain-text alert to the configured Discord webhook.
 * Silently does nothing if no webhook is configured. Never throws.
 */
export async function sendDiscordAlert(message: string): Promise<void> {
  const url = webhookUrl();
  if (!url || !message) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord caps message content at 2000 chars.
      body: JSON.stringify({ content: message.slice(0, 1900) }),
    });
  } catch {
    // best-effort — never block the request path
  }
}

/**
 * Warn (via Discord) about any items at or below the low-stock threshold.
 * Safe to call on every inventory create/update; no-op when nothing is low.
 */
export async function notifyLowStock(
  items: { sku: string; name: string; quantity: number }[],
  context: string
): Promise<void> {
  const threshold = lowStockThreshold();
  const low = (items || []).filter(
    (i) => Number.isFinite(i.quantity) && i.quantity <= threshold
  );
  if (low.length === 0) return;

  const lines = low.map((i) => `• ${i.name} (${i.sku}) — ${i.quantity} left`);
  await sendDiscordAlert(`⚠️ Low stock (${context}):\n${lines.join("\n")}`);
}

// ── Discord alert helpers ─────────────────────────────────────────────────────
// Supports both plain-text messages and rich embeds.
// All functions are best-effort — failures are silently swallowed so they
// never crash the main request flow.

type LowStockItem = {
  sku: string;
  name: string;
  quantity: number;
};

// Discord embed colors (decimal)
export const DISCORD_COLOR = {
  green:  0x2ecc71,   // new order, delivery success
  blue:   0x3498db,   // renewal
  red:    0xe74c3c,   // cancelled, payment failed, chargeback
  orange: 0xe67e22,   // warning, low stock, past due
  gray:   0x95a5a6,   // neutral / info
} as const;

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string };
  timestamp?: string; // ISO string
};

function getDiscordWebhookUrl() {
  return process.env.DISCORD_ALERT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || "";
}

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function getLowStockThreshold() {
  const raw = process.env.LOW_STOCK_THRESHOLD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
}

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// ── Low-level send ────────────────────────────────────────────────────────────

export async function sendDiscordAlert(content: string) {
  const url = getDiscordWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
  } catch { /* best-effort */ }
}

export async function sendDiscordEmbed(embed: DiscordEmbed) {
  const url = getDiscordWebhookUrl();
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp ?? new Date().toISOString() }],
      }),
    });
  } catch { /* best-effort */ }
}

// ── Named event helpers ───────────────────────────────────────────────────────

/** New order / initial subscription delivery */
export async function notifyNewOrder({
  customerEmail,
  productName,
  quantity,
  amountCents,
  linesDelivered,
  sku,
}: {
  customerEmail: string;
  productName: string;
  quantity: number;
  amountCents: number;
  linesDelivered: number;
  sku: string;
}) {
  await sendDiscordEmbed({
    title: "🛒  New Order Received",
    color: DISCORD_COLOR.green,
    fields: [
      { name: "Customer",   value: `\`${customerEmail}\``,           inline: true },
      { name: "Product",    value: productName,                       inline: true },
      { name: "Qty",        value: String(quantity),                  inline: true },
      { name: "Amount",     value: fmt(amountCents),                  inline: true },
      { name: "SKU",        value: `\`${sku}\``,                     inline: true },
      { name: "Delivered",  value: `${linesDelivered} line(s) sent`,  inline: true },
    ],
    footer: { text: "Viking Essentials — Order System" },
  });
}

/** Subscription renewed successfully */
export async function notifyRenewal({
  customerEmail,
  planName,
  amountCents,
  nextRenewal,
}: {
  customerEmail: string;
  planName: string;
  amountCents: number;
  nextRenewal?: Date | null;
}) {
  const fields: DiscordEmbedField[] = [
    { name: "Customer",  value: `\`${customerEmail}\``, inline: true },
    { name: "Plan",      value: planName,                inline: true },
    { name: "Amount",    value: fmt(amountCents),        inline: true },
  ];
  if (nextRenewal) {
    fields.push({
      name: "Next Renewal",
      value: nextRenewal.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      inline: true,
    });
  }
  await sendDiscordEmbed({
    title: "🔄  Subscription Renewed",
    color: DISCORD_COLOR.blue,
    fields,
    footer: { text: "Viking Essentials — Billing" },
  });
}

/** Subscription cancelled */
export async function notifyCancellation({
  customerEmail,
  planName,
  subscriptionId,
}: {
  customerEmail: string;
  planName?: string;
  subscriptionId?: string;
}) {
  await sendDiscordEmbed({
    title: "🚫  Subscription Cancelled",
    color: DISCORD_COLOR.red,
    fields: [
      { name: "Customer",  value: `\`${customerEmail}\``,             inline: true },
      { name: "Plan",      value: planName ?? "Unknown",               inline: true },
      ...(subscriptionId ? [{ name: "Sub ID", value: `\`${subscriptionId}\``, inline: false }] : []),
      { name: "Action",    value: "Revoke access + reclaim ISP lines", inline: false },
    ],
    footer: { text: "Viking Essentials — Billing" },
  });
}

/** Payment failed */
export async function notifyPaymentFailed({
  customerEmail,
  subscriptionId,
  amountCents,
}: {
  customerEmail: string;
  subscriptionId?: string | null;
  amountCents?: number;
}) {
  const fields: DiscordEmbedField[] = [
    { name: "Customer",  value: `\`${customerEmail}\``, inline: true },
    ...(amountCents ? [{ name: "Amount",   value: fmt(amountCents), inline: true }] : []),
    ...(subscriptionId ? [{ name: "Sub ID",   value: `\`${subscriptionId}\``, inline: false }] : []),
    { name: "Status",    value: "Set to `past_due`",    inline: true },
    { name: "Required",  value: "Customer must update payment method in Billing portal", inline: false },
  ];
  await sendDiscordEmbed({
    title: "❌  Payment Failed",
    color: DISCORD_COLOR.red,
    fields,
    footer: { text: "Viking Essentials — Billing" },
  });
}

/** Subscription past_due warning */
export async function notifyPastDue({
  customerEmail,
  subscriptionId,
}: {
  customerEmail: string;
  subscriptionId?: string;
}) {
  await sendDiscordEmbed({
    title: "⚠️  Subscription Past Due",
    color: DISCORD_COLOR.orange,
    fields: [
      { name: "Customer",  value: `\`${customerEmail}\``, inline: true },
      ...(subscriptionId ? [{ name: "Sub ID", value: `\`${subscriptionId}\``, inline: true }] : []),
      { name: "Action",    value: "Customer must update card via Billing portal", inline: false },
    ],
    footer: { text: "Viking Essentials — Billing" },
  });
}

/** Chargeback / dispute opened */
export async function notifyChargeback({
  amountCents,
  reason,
  status,
}: {
  amountCents: number;
  reason: string;
  status: string;
}) {
  await sendDiscordEmbed({
    title: "🚨  CHARGEBACK DISPUTE OPENED",
    color: DISCORD_COLOR.red,
    description: "**You have 7 days to respond — go to Stripe Dashboard → Disputes NOW**",
    fields: [
      { name: "Amount",  value: fmt(amountCents),   inline: true },
      { name: "Reason",  value: reason,             inline: true },
      { name: "Status",  value: status,             inline: true },
    ],
    footer: { text: "Viking Essentials — Billing" },
  });
}

/** Low stock warning */
export async function notifyLowStock(items: LowStockItem[], source: string) {
  const threshold = getLowStockThreshold();
  const lowStock = items.filter((item) => item.quantity <= threshold);
  if (lowStock.length === 0) return;

  await sendDiscordEmbed({
    title: "⚠️  Low Stock Alert",
    color: DISCORD_COLOR.orange,
    description: `Triggered by: \`${source}\` | Threshold: **${threshold}**`,
    fields: lowStock.map((item) => ({
      name: item.name,
      value: `SKU: \`${item.sku}\` — **${item.quantity}** remaining`,
      inline: false,
    })),
    footer: { text: "Viking Essentials — Inventory" },
  });
}

/** Pool critically low after a delivery */
export async function notifyPoolLow({
  sku,
  remaining,
}: {
  sku: string;
  remaining: number;
}) {
  await sendDiscordEmbed({
    title: "⚠️  Inventory Pool Low",
    color: DISCORD_COLOR.orange,
    fields: [
      { name: "SKU",       value: `\`${sku}\``,                    inline: true },
      { name: "Remaining", value: `**${remaining}** lines left`,    inline: true },
      { name: "Action",    value: "Add more stock at /admin/inventory before next subscription", inline: false },
    ],
    footer: { text: "Viking Essentials — Inventory" },
  });
}

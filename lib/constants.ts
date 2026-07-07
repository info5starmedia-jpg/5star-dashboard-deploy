// Single source of truth for OWNER_EMAIL.
export const OWNER_EMAIL =
  (process.env.OWNER_EMAIL || "").replace(/^["']|["']$/g, "").trim() ||
  "info.5starmedia@gmail.com";

// ── ISP shared pool SKU ───────────────────────────────────────────────────────
// Admin adds ONE inventory item with this SKU and pastes all ISP lines into
// the Content field. The quantity auto-sets to the number of lines.
// Pack availability is determined by pool.quantity >= packSize.
export const ISP_POOL_SKU = "isp-pool";

// ── Inventory "Add Item" categories ──────────────────────────────────────────
// Powers the category dropdown on /admin/inventory so the admin never has to
// remember or retype a SKU. Two kinds of category:
//
//   - Pooled (sku set):    one canonical SKU, reused every time. Picking it
//     pre-fills Name + SKU; if that SKU already has stock, the form adds to
//     its quantity instead of creating a duplicate row (matches how the ISP
//     proxy pool already works).
//   - Freeform (sku null): every add is a distinct new item (e.g. one-off
//     digital products), so the SKU is suggested from the name instead of
//     fixed, and stays editable.
export type InventoryCategoryKey =
  | "server"
  | "isp_proxies"
  | "ipv4_proxies"
  | "subnets"
  | "digital_product"
  | "other";

export type InventoryCategory = {
  key: InventoryCategoryKey;
  label: string;
  sku: string | null; // null = freeform, unique SKU per item
  defaultName: string;
  hasSubtitle: boolean;
};

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  { key: "server", label: "Viking Servers", sku: "server-pool", defaultName: "Viking Server", hasSubtitle: false },
  { key: "isp_proxies", label: "Viking USA ISP Proxies", sku: ISP_POOL_SKU, defaultName: "Viking USA ISP Proxies", hasSubtitle: false },
  { key: "ipv4_proxies", label: "IPv4 Proxies", sku: "ipv4-pool", defaultName: "IPv4 Proxies", hasSubtitle: false },
  { key: "subnets", label: "Subnets", sku: "subnet-pool", defaultName: "Subnets", hasSubtitle: false },
  { key: "digital_product", label: "Digital Product", sku: null, defaultName: "", hasSubtitle: true },
  { key: "other", label: "Other / Custom", sku: null, defaultName: "", hasSubtitle: false },
];

export function getInventoryCategory(key: string): InventoryCategory {
  return INVENTORY_CATEGORIES.find((c) => c.key === key) ?? INVENTORY_CATEGORIES[0];
}

// ── Recurring subscription plans ─────────────────────────────────────────────
// TWO logical products:
//   1. HUSCARL 32X64 Server  — dedicated server access
//   2. Viking USA ISP        — shared ISP pool, multiple pack sizes
//
// Each ISP pack size is a different Stripe Price under the same logical product.
// Admin loads lines into ONE inventory item (SKU: isp-pool). Dashboard checks
// pool.quantity >= packSize to enable/disable each pack tier.

export type PlanSlug = "server" | "isp_10" | "isp_25" | "isp_50" | "isp_75";

export type Plan = {
  slug: PlanSlug;
  name: string;
  description: string;
  priceCents: number;        // monthly price in cents
  packSize: number | null;   // null = server (no ISP lines), number = lines per cycle
  stripeProductId: string;   // prod_xxx from Stripe dashboard
  envKey: string;            // env var name holding the Stripe Price ID (price_xxx)
  badge?: string;
  features: string[];        // customer-facing feature bullets
};

export const PLANS: Plan[] = [
  {
    slug: "server",
    name: "HUSCARL 32X64 Server",
    description: "Full dedicated server access. Renewed monthly.",
    priceCents: 12000,         // $120.00
    packSize: null,
    stripeProductId: "prod_UGiw1Mtaeeb30W",
    envKey: "STRIPE_PRICE_ID_SERVER",
    features: [
      "Full dedicated server access",
      "32 cores / 64 threads",
      "High-speed bandwidth",
      "Monthly recurring",
      "Cancel anytime",
    ],
  },
  {
    slug: "isp_10",
    name: "Viking USA ISP -- 10 Pack",
    description: "10 premium USA ISP proxies delivered on subscription.",
    priceCents: 3000,          // $30.00
    packSize: 10,
    stripeProductId: "prod_UGjuCI2sd4MLzW",
    envKey: "STRIPE_PRICE_ID_ISP_10",
    features: [
      "10 dedicated USA ISP proxies",
      "Yours for the life of subscription",
      "High-speed residential IPs",
      "Cancel anytime",
    ],
  },
  {
    slug: "isp_25",
    name: "Viking USA ISP -- 25 Pack",
    description: "25 premium USA ISP proxies delivered on subscription.",
    priceCents: 7500,          // $75.00
    packSize: 25,
    stripeProductId: "prod_UGjxFpoI4Jak1B",
    envKey: "STRIPE_PRICE_ID_ISP_25",
    badge: "Popular",
    features: [
      "25 dedicated USA ISP proxies",
      "Yours for the life of subscription",
      "High-speed residential IPs",
      "Cancel anytime",
    ],
  },
  {
    slug: "isp_50",
    name: "Viking USA ISP -- 50 Pack",
    description: "50 premium USA ISP proxies delivered on subscription.",
    priceCents: 15000,         // $150.00
    packSize: 50,
    stripeProductId: "prod_UGk2QE7Z4tGPbE",
    envKey: "STRIPE_PRICE_ID_ISP_50",
    badge: "Best Value",
    features: [
      "50 dedicated USA ISP proxies",
      "Yours for the life of subscription",
      "High-speed residential IPs",
      "Cancel anytime",
    ],
  },
  {
    slug: "isp_75",
    name: "Viking USA ISP -- 75 Pack",
    description: "75 premium USA ISP proxies delivered on subscription.",
    priceCents: 22500,         // $225.00
    packSize: 75,
    stripeProductId: "",       // Set in Stripe dashboard — add prod_xxx here
    envKey: "STRIPE_PRICE_ID_ISP_75",
    features: [
      "75 dedicated USA ISP proxies",
      "Yours for the life of subscription",
      "High-speed residential IPs",
      "Cancel anytime",
    ],
  },
];

function cleanEnv(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

export function getPriceIdForPlan(slug: PlanSlug): string | null {
  const plan = PLANS.find((p) => p.slug === slug);
  if (!plan) return null;
  return cleanEnv(plan.envKey) || null;
}

export function getPlanByPriceId(priceId: string): Plan | null {
  return PLANS.find((p) => cleanEnv(p.envKey) === priceId) ?? null;
}

export function getPlanBySlug(slug: string): Plan | null {
  return PLANS.find((p) => p.slug === slug) ?? null;
}

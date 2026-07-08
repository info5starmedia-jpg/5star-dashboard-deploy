// Single source of truth for OWNER_EMAIL.
export const OWNER_EMAIL =
  (process.env.OWNER_EMAIL || "").replace(/^["']|["']$/g, "").trim() ||
  "info.5starmedia@gmail.com";

// ── Inventory pool SKUs ────────────────────────────────────────────────────────
// Admin loads lines into ONE inventory item per pool and pastes all lines into
// the Content field. The quantity auto-sets to the number of lines. Pack
// availability is determined by pool.quantity >= packSize.
export const ISP_POOL_SKU = "isp-pool1";     // All ISP pack tiers share this pool
export const SERVER_SKU   = "viking_server"; // VIKING HELGER SERVER lines
export const ACC_SKU      = "viking_acc";    // VIKING HYBRID RETAIL ACC lines

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
  | "viking_acc"
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
  { key: "server", label: "Viking Servers", sku: SERVER_SKU, defaultName: "VIKING HELGER SERVER", hasSubtitle: false },
  { key: "viking_acc", label: "Viking Hybrid Retail Acc", sku: ACC_SKU, defaultName: "VIKING HYBRID RETAIL ACC", hasSubtitle: false },
  { key: "isp_proxies", label: "Viking USA ISP Proxies", sku: ISP_POOL_SKU, defaultName: "HUSCARL USA ISP Proxies", hasSubtitle: false },
  { key: "ipv4_proxies", label: "IPv4 Proxies", sku: "ipv4-pool", defaultName: "IPv4 Proxies", hasSubtitle: false },
  { key: "subnets", label: "Subnets", sku: "subnet-pool", defaultName: "Subnets", hasSubtitle: false },
  { key: "digital_product", label: "Digital Product", sku: null, defaultName: "Digital Product", hasSubtitle: true },
  { key: "other", label: "Other / Custom", sku: null, defaultName: "Custom Product", hasSubtitle: false },
];

export function getInventoryCategory(key: string): InventoryCategory {
  return INVENTORY_CATEGORIES.find((c) => c.key === key) ?? INVENTORY_CATEGORIES[0];
}

// ── Recurring subscription plans ─────────────────────────────────────────────
// Logical products:
//   1. VIKING HELGER SERVER      — dedicated server access
//   2. VIKING HYBRID RETAIL ACC  — one-time hybrid retail account
//   3. HUSCARL USA ISP           — shared ISP pool, multiple pack sizes
//
// Each ISP pack size is a different Stripe Price under the same logical product.
// Admin loads lines into ONE inventory item per pool (see inventorySku below).
// Dashboard checks pool.quantity >= packSize to enable/disable each pack tier.

export type PlanSlug =
  | "server"
  | "viking_acc"
  | "isp_10"
  | "isp_25"
  | "isp_50"
  | "isp_75";

export type Plan = {
  slug: PlanSlug;
  name: string;
  description: string;
  priceCents: number;        // price in cents
  packSize: number;          // lines drawn from the inventory pool per cycle
  inventorySku: string;      // which inventory pool SKU this plan draws from
  stripeProductId: string;   // prod_xxx from Stripe dashboard
  envKey: string;            // env var name holding the Stripe Price ID (price_xxx)
  badge?: string;
  features: string[];        // customer-facing feature bullets
  oneTime?: boolean;         // true = one-time purchase (not a subscription)
};

export const PLANS: Plan[] = [
  {
    slug: "server",
    name: "VIKING HELGER SERVER",
    description: "Full dedicated server access. Renewed monthly.",
    priceCents: 12000,
    packSize: 1,
    inventorySku: SERVER_SKU,
    stripeProductId: "prod_UHAdq1BkXKxWen",
    envKey: "STRIPE_PRICE_ID_SERVER",
    features: [
      "32 Thread CPU",
      "64GB RAM",
      "SSD 480GB",
      "10GB Uplink",
      "Virginia, USA",
      "Premium Tier",
    ],
  },
  {
    slug: "viking_acc",
    name: "VIKING HYBRID RETAIL ACC",
    description: "Premium hybrid retail account. One-time purchase.",
    priceCents: 1000,
    packSize: 1,
    inventorySku: ACC_SKU,
    stripeProductId: "",
    envKey: "STRIPE_PRICE_ID_VIKING_ACC",
    oneTime: true,
    features: [
      "Premium hybrid retail account",
      "High-performance access",
      "One-time purchase",
      "Instant Delivery",
    ],
  },
  {
    slug: "isp_10",
    name: "HUSCARL USA ISP -- 10 Pack",
    description: "10 premium USA ISP proxies delivered on subscription.",
    priceCents: 3000,
    packSize: 10,
    inventorySku: ISP_POOL_SKU,
    stripeProductId: "prod_UH8iAH5xWEsbFz",
    envKey: "STRIPE_PRICE_ID_ISP_10",
    features: [
      "Private datacenter / USA",
      "Ashburn, VA",
      "10GB/s Network Speed",
      "Unlocked 24/7",
      "Instant Delivery",
    ],
  },
  {
    slug: "isp_25",
    name: "HUSCARL USA ISP -- 25 Pack",
    description: "25 premium USA ISP proxies delivered on subscription.",
    priceCents: 7500,
    packSize: 25,
    inventorySku: ISP_POOL_SKU,
    stripeProductId: "prod_UH8p0QG8naGuCc",
    envKey: "STRIPE_PRICE_ID_ISP_25",
    badge: "Popular",
    features: [
      "Private datacenter / USA",
      "Ashburn, VA",
      "10GB/s Network Speed",
      "Unlocked 24/7",
      "Instant Delivery",
    ],
  },
  {
    slug: "isp_50",
    name: "HUSCARL USA ISP -- 50 Pack",
    description: "50 premium USA ISP proxies delivered on subscription.",
    priceCents: 15000,
    packSize: 50,
    inventorySku: ISP_POOL_SKU,
    stripeProductId: "prod_UH8uy4dviKUzHb",
    envKey: "STRIPE_PRICE_ID_ISP_50",
    badge: "Best Value",
    features: [
      "Private datacenter / USA",
      "Ashburn, VA",
      "10GB/s Network Speed",
      "Unlocked 24/7",
      "Instant Delivery",
    ],
  },
  {
    slug: "isp_75",
    name: "HUSCARL USA ISP -- 75 Pack",
    description: "75 premium USA ISP proxies delivered on subscription.",
    priceCents: 22500,
    packSize: 75,
    inventorySku: ISP_POOL_SKU,
    stripeProductId: "",
    envKey: "STRIPE_PRICE_ID_ISP_75",
    features: [
      "Private datacenter / USA",
      "Ashburn, VA",
      "10GB/s Network Speed",
      "Unlocked 24/7",
      "Instant Delivery",
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

// Single source of truth for OWNER_EMAIL.
export const OWNER_EMAIL =
  (process.env.OWNER_EMAIL || "").replace(/^["']|["']$/g, "").trim() ||
  "info.5starmedia@gmail.com";

// ── Inventory pool SKUs ────────────────────────────────────────────────────────
export const ISP_POOL_SKU = "isp-pool1";     // All ISP pack tiers share this pool
export const SERVER_SKU   = "viking_server"; // VIKING HELGER SERVER lines
export const ACC_SKU      = "viking_acc";    // VIKING HYBRID RETAIL ACC lines

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
  priceCents: number;
  packSize: number;
  inventorySku: string;
  stripeProductId: string;
  envKey: string;
  badge?: string;
  features: string[];
  oneTime?: boolean;
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


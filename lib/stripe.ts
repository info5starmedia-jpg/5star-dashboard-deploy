import Stripe from "stripe";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

// Stripe SDK v20+ TypeScript types only accept "2025-12-15.clover" but the
// 2025-12-15.clover API renamed the "coupon" parameter to "discount" on
// promotionCodes.create(). Casting to any here forces the runtime to use
// the 2023-10-16 API version which still accepts "coupon".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new Stripe(envClean("STRIPE_SECRET_KEY"), {
  apiVersion: "2023-10-16" as any,
});

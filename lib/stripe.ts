import Stripe from "stripe";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

// Stripe SDK v20+ has a typed apiVersion union.
// Use the version expected by the installed SDK types.
export const stripe = new Stripe(envClean("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-12-15.clover",
});

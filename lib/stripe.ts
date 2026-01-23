import Stripe from "stripe";

// Stripe SDK v20+ has a typed apiVersion union.
// Use the version expected by the installed SDK types.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

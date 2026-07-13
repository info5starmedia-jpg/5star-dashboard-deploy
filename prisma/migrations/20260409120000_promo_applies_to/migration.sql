-- AlterTable: add appliesToProducts column to PromoCode
-- NULL means the code applies to ALL products (universal)
-- Non-null means a JSON array of Stripe product IDs, e.g. ["prod_abc","prod_xyz"]
ALTER TABLE "PromoCode" ADD COLUMN "appliesToProducts" TEXT;

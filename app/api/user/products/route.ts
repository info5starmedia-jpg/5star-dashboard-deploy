import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, ISP_POOL_SKU } from "@/lib/constants";
import { rateLimit } from "@/lib/rateLimit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 20 requests per minute — prevents inventory scraping
  if (rateLimit(`products:${session.user.email}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Collect all unique inventory SKUs needed by PLANS (one DB query)
  const uniqueSkus = [...new Set(PLANS.map((p) => p.inventorySku))];
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { sku: { in: uniqueSkus } },
    select: { sku: true, quantity: true },
  });

  // Build a fast lookup: sku → quantity in stock
  const stockMap = Object.fromEntries(
    inventoryItems.map((item) => [item.sku, item.quantity])
  );

  const plans = PLANS
    .map((plan) => {
      const isPooled = plan.packSize !== null && plan.packSize !== undefined;
      const poolQty = stockMap[plan.inventorySku] ?? 0;
      // Non-pooled plans (packSize null) are always available and expose no pool.
      const available = isPooled ? poolQty >= plan.packSize! : true;

      return {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        packSize: plan.packSize,
        inventorySku: plan.inventorySku,
        badge: plan.badge ?? null,
        features: plan.features,
        available,
        poolQuantity: isPooled ? poolQty : null,
        oneTime: plan.oneTime ?? false,
      };
    })
    // One-time plans are hidden completely when out of stock
    .filter((plan) => !(plan.oneTime && plan.poolQuantity === 0));

  return NextResponse.json({ plans });
}

// Re-export ISP_POOL_SKU so other modules can import it from here
export { ISP_POOL_SKU };

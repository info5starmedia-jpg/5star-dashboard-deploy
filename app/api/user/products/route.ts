import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PLANS, ISP_POOL_SKU } from "@/lib/constants";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ispPool = await prisma.inventoryItem.findUnique({ where: { sku: ISP_POOL_SKU } });
  const poolQuantity = ispPool?.quantity ?? 0;

  const plans = PLANS.map((plan) => {
    const isPooled = plan.packSize !== null;
    const available = isPooled ? poolQuantity >= plan.packSize! : true;

    return {
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      packSize: plan.packSize,
      badge: plan.badge ?? null,
      features: plan.features,
      available,
      poolQuantity: isPooled ? poolQuantity : null,
    };
  });

  return NextResponse.json({ plans });
}

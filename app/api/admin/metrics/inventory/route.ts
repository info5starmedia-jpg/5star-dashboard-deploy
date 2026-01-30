import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.inventoryItem.findMany();

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValueCents = items.reduce((sum, item) => sum + item.quantity * item.priceCents, 0);
  const totalCostCents = items.reduce((sum, item) => sum + item.quantity * item.costCents, 0);
  const profitCents = totalValueCents - totalCostCents;

  return NextResponse.json({
    metrics: {
      totalUnits,
      totalValueCents,
      totalCostCents,
      profitCents,
    },
  });
}

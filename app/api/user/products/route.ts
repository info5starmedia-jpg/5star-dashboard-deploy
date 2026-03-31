import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await prisma.inventoryItem.findMany({
    where: { quantity: { gt: 0 } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, priceCents: true, quantity: true },
  });

  return NextResponse.json({ products });
}

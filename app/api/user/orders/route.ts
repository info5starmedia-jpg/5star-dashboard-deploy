import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.invoice.findMany({
    where: {
      customerEmail: session.user.email,
      status: "issued",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      totalCents: true,
      subtotalCents: true,
      taxCents: true,
      status: true,
      lineItems: {
        select: {
          id: true,
          description: true,
          sku: true,
          quantity: true,
          unitPriceCents: true,
          totalCents: true,
        },
      },
    },
  });

  return NextResponse.json({ orders });
}

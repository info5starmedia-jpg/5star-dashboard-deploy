import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { userEmail: session.user.email },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      priceId: true,
    },
  });

  return NextResponse.json({
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          priceId: sub.priceId,
        }
      : null,
  });
}

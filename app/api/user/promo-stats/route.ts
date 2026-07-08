import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user/promo-stats — promoter sees their own code stats
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; isPromoter?: boolean; isAdmin?: boolean } | undefined;

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.isPromoter && !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admins can see all; promoters only see codes where promoter matches their email or name
  // Promoters are matched by their email (stored in promoter field)
  const where = user.isAdmin ? {} : { promoter: user.email };

  const codes = await prisma.promoCode.findMany({
    where,
    orderBy: { totalRevenueCents: "desc" },
    include: {
      usages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  return NextResponse.json({ codes });
}

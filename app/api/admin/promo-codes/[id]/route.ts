import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; isAdmin?: boolean } | undefined;
  if (!user?.email || !user?.isAdmin) return null;
  return session;
}

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/promo-codes/[id] — detail + usage table
export async function GET(_req: Request, { params }: RouteContext) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const code = await prisma.promoCode.findUnique({
    where: { id },
    include: {
      usages: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!code) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ code });
}

// PATCH /api/admin/promo-codes/[id] — toggle active status
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null) as { isActive?: boolean } | null;
  if (typeof body?.isActive !== "boolean") {
    return NextResponse.json({ error: "Missing isActive" }, { status: 400 });
  }

  const code = await prisma.promoCode.findUnique({ where: { id } });
  if (!code) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Sync active status to Stripe promo code
  if (code.stripePromoId) {
    try {
      await stripe.promotionCodes.update(code.stripePromoId, { active: body.isActive });
    } catch { /* best-effort */ }
  }

  const updated = await prisma.promoCode.update({
    where: { id },
    data: { isActive: body.isActive },
  });

  return NextResponse.json({ code: updated });
}

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

// GET /api/admin/promo-codes
export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const codes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { usages: true } } },
    });

    return NextResponse.json({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        promoter: c.promoter,
        discountType: c.discountType,
        discountValue: c.discountValue,
        isLifetime: c.isLifetime,
        expiresAt: c.expiresAt,
        isActive: c.isActive,
        stripeCouponId: c.stripeCouponId,
        stripePromoId: c.stripePromoId,
        totalUses: c.totalUses,
        totalRevenueCents: c.totalRevenueCents,
        appliesToProducts: c.appliesToProducts ? JSON.parse(c.appliesToProducts) : null,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/promo-codes error:", err);
    return NextResponse.json({ error: "Failed to load promo codes" }, { status: 500 });
  }
}

// POST /api/admin/promo-codes
export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    code: string;
    promoter: string;
    discountType: "percent" | "amount";
    discountValue: number;
    isLifetime: boolean;
    expiresAt?: string | null;
    isActive: boolean;
    appliesToProducts?: string[]; // array of Stripe product IDs, empty = all products
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, promoter, discountType, discountValue, isLifetime, expiresAt, isActive, appliesToProducts } = body;

  // Validation
  if (!code?.trim() || !promoter?.trim()) {
    return NextResponse.json({ error: "Code and promoter are required" }, { status: 400 });
  }
  if (!["percent", "amount"].includes(discountType)) {
    return NextResponse.json({ error: "Invalid discount type" }, { status: 400 });
  }
  if (!discountValue || discountValue <= 0) {
    return NextResponse.json({ error: "Discount value must be positive" }, { status: 400 });
  }
  if (discountType === "percent" && discountValue > 100) {
    return NextResponse.json({ error: "Percentage cannot exceed 100" }, { status: 400 });
  }
  if (discountType === "amount" && !Number.isInteger(discountValue)) {
    return NextResponse.json({ error: "Amount must be a whole number of cents (e.g. 1000 = $10.00)" }, { status: 400 });
  }

  // Check for duplicate code in DB
  const existing = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (existing) {
    return NextResponse.json({ error: `Code "${code}" already exists` }, { status: 409 });
  }

  // Filter to only valid (non-empty) product IDs
  const productIds = (appliesToProducts ?? []).filter((id) => id && id.trim().length > 0);

  // Build Stripe coupon params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const couponParams: any = {
    name: code.trim().toUpperCase(),
    duration: isLifetime ? "forever" : "once",
    metadata: { promoter, createdBy: "dashboard" },
  };

  if (discountType === "percent") {
    couponParams.percent_off = discountValue;
  } else {
    couponParams.amount_off = Math.round(discountValue);
    couponParams.currency = "usd";
  }

  // Restrict coupon to specific products in Stripe if any were selected
  if (productIds.length > 0) {
    couponParams.applies_to = { products: productIds };
  }

  if (!isLifetime && expiresAt) {
    couponParams.redeem_by = Math.floor(new Date(expiresAt).getTime() / 1000);
  }

  let stripeCouponId: string | null = null;
  let stripePromoId: string | null = null;

  try {
    // Create Stripe coupon
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coupon = await (stripe.coupons.create as any)(couponParams);
    stripeCouponId = coupon.id;

    // Create Stripe promotion code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const promoCode = await (stripe.promotionCodes.create as any)({
      coupon: coupon.id,
      code: code.trim().toUpperCase(),
      active: isActive,
    });
    stripePromoId = promoCode.id;
  } catch (stripeErr: unknown) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Unknown Stripe error";
    // Clean up coupon if promo code creation failed
    if (stripeCouponId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (stripe.coupons.del as any)(stripeCouponId);
      } catch { /* best effort */ }
    }
    return NextResponse.json({ error: `Stripe sync failed: ${msg}` }, { status: 502 });
  }

  // Save to DB
  try {
    const record = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        promoter: promoter.trim(),
        discountType,
        discountValue: Math.round(discountValue),
        isLifetime,
        expiresAt: !isLifetime && expiresAt ? new Date(expiresAt) : null,
        isActive,
        stripeCouponId,
        stripePromoId,
        appliesToProducts: productIds.length > 0 ? JSON.stringify(productIds) : null,
      },
    });

    return NextResponse.json({
      promoCode: {
        ...record,
        appliesToProducts: productIds.length > 0 ? productIds : null,
      },
    });
  } catch (dbErr) {
    console.error("DB insert failed after Stripe create:", dbErr);
    // Deactivate the Stripe promo code so it can't be used
    if (stripePromoId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (stripe.promotionCodes.update as any)(stripePromoId, { active: false });
      } catch { /* best effort */ }
    }
    return NextResponse.json({ error: "Code created in Stripe but failed to save to database. Please contact support." }, { status: 500 });
  }
}

// DELETE /api/admin/promo-codes?id=xxx
export async function DELETE(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const record = await prisma.promoCode.findUnique({ where: { id } });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deactivate in Stripe first (best effort)
  if (record.stripePromoId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (stripe.promotionCodes.update as any)(record.stripePromoId, { active: false });
    } catch { /* best effort */ }
  }

  await prisma.promoCode.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

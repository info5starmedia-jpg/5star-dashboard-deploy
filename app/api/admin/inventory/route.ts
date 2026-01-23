import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/isAdmin";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  if (!email || !isAdminEmail(email)) return null;
  return { email };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const sku = String(body?.sku || "").trim();
  const quantity = Number(body?.quantity ?? 0);
  const priceCents = Number(body?.priceCents ?? 0);

  if (!name || !sku) return NextResponse.json({ error: "Missing name or sku" }, { status: 400 });
  if (!Number.isFinite(quantity) || !Number.isFinite(priceCents)) {
    return NextResponse.json({ error: "Invalid quantity/priceCents" }, { status: 400 });
  }

  const item = await prisma.inventoryItem.create({ data: { name, sku, quantity, priceCents } });
  return NextResponse.json({ item });
}

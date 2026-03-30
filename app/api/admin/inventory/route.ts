import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { notifyLowStock } from "@/lib/alerts";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const sku = String(body?.sku || "").trim();
  const quantity = Math.floor(Number(body?.quantity ?? 0));
  const priceCents = Math.floor(Number(body?.priceCents ?? 0));
  const costCents = Math.floor(Number(body?.costCents ?? 0));

  if (!name || !sku) return NextResponse.json({ error: "Missing name or sku" }, { status: 400 });
  if (!Number.isFinite(quantity) || quantity < 0) {
    return NextResponse.json({ error: "Quantity must be a non-negative integer" }, { status: 400 });
  }
  if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(costCents) || costCents < 0) {
    return NextResponse.json({ error: "Price and cost must be non-negative" }, { status: 400 });
  }

  const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
  if (existing) {
    return NextResponse.json({ error: `SKU "${sku}" already exists` }, { status: 409 });
  }

  const item = await prisma.inventoryItem.create({ data: { name, sku, quantity, priceCents, costCents } });

  await logAudit({
    actorEmail: session.user?.email || "unknown",
    action: `inventory_create: ${item.name} (SKU: ${item.sku}, qty: ${item.quantity}, price: ${item.priceCents})`,
  });

  await notifyLowStock([{ sku: item.sku, name: item.name, quantity: item.quantity }], "inventory create");
  return NextResponse.json({ item });
}

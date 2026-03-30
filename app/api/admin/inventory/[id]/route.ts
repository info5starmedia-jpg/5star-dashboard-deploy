import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { notifyLowStock } from "@/lib/alerts";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    updates.name = name;
    changes.push(`name: "${existing.name}" → "${name}"`);
  }
  if (body.quantity !== undefined) {
    const quantity = Math.floor(Number(body.quantity));
    if (!Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ error: "Quantity must be a non-negative number" }, { status: 400 });
    }
    updates.quantity = quantity;
    changes.push(`qty: ${existing.quantity} → ${quantity}`);
  }
  if (body.priceCents !== undefined) {
    const priceCents = Math.floor(Number(body.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "Price must be non-negative" }, { status: 400 });
    }
    updates.priceCents = priceCents;
    changes.push(`price: ${existing.priceCents}¢ → ${priceCents}¢`);
  }
  if (body.costCents !== undefined) {
    const costCents = Math.floor(Number(body.costCents));
    if (!Number.isFinite(costCents) || costCents < 0) {
      return NextResponse.json({ error: "Cost must be non-negative" }, { status: 400 });
    }
    updates.costCents = costCents;
    changes.push(`cost: ${existing.costCents}¢ → ${costCents}¢`);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const item = await prisma.inventoryItem.update({ where: { id }, data: updates });

  await logAudit({
    actorEmail: session.user?.email || "unknown",
    action: `inventory_update: ${existing.sku} — ${changes.join(", ")}`,
  });

  await notifyLowStock([{ sku: item.sku, name: item.name, quantity: item.quantity }], "inventory update");
  return NextResponse.json({ item });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const existing = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.inventoryItem.delete({ where: { id } });

  await logAudit({
    actorEmail: session.user?.email || "unknown",
    action: `inventory_delete: ${existing.name} (SKU: ${existing.sku}, qty: ${existing.quantity})`,
  });

  return NextResponse.json({ ok: true });
}

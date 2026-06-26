import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

// Bulk import of inventory items — built for the Seated email -> code pipeline,
// but generic: it accepts any list of { sku, name, quantity?, priceCents?,
// costCents? } and upserts them, skipping SKUs that already exist so re-running
// a scan is idempotent (the same code is never imported twice).
//
// Auth: either a logged-in admin session OR an `x-import-token` header matching
// the INVENTORY_IMPORT_TOKEN env var. The token path lets an automated agent
// push codes without a browser session.

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

function tokenMatches(provided: string | null): boolean {
  const expected = envClean("INVENTORY_IMPORT_TOKEN");
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type IncomingItem = {
  sku?: unknown;
  name?: unknown;
  quantity?: unknown;
  priceCents?: unknown;
  costCents?: unknown;
};

export async function POST(req: Request) {
  // Authenticate: admin session OR import token.
  const session = await requireAdminSession();
  const headerToken = req.headers.get("x-import-token");
  const viaToken = !session && tokenMatches(headerToken);
  if (!session && !viaToken) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actorEmail = session?.user?.email || "import-token";

  const body = await req.json().catch(() => ({}));
  const rawItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }
  if (rawItems.length > 1000) {
    return NextResponse.json({ error: "Too many items (max 1000 per request)" }, { status: 400 });
  }

  const created: { sku: string; name: string }[] = [];
  const skipped: { sku: string; reason: string }[] = [];
  const errors: { sku: string; error: string }[] = [];

  for (const raw of rawItems) {
    const sku = String(raw?.sku ?? "").trim();
    const name = String(raw?.name ?? "").trim();
    const quantity = raw?.quantity === undefined ? 1 : Math.floor(Number(raw.quantity));
    const priceCents = raw?.priceCents === undefined ? 0 : Math.floor(Number(raw.priceCents));
    const costCents = raw?.costCents === undefined ? 0 : Math.floor(Number(raw.costCents));

    if (!sku || !name) {
      errors.push({ sku: sku || "(missing)", error: "Missing sku or name" });
      continue;
    }
    if (!Number.isFinite(quantity) || quantity < 0) {
      errors.push({ sku, error: "Quantity must be a non-negative number" });
      continue;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0 || !Number.isFinite(costCents) || costCents < 0) {
      errors.push({ sku, error: "Price and cost must be non-negative" });
      continue;
    }

    const existing = await prisma.inventoryItem.findUnique({ where: { sku } });
    if (existing) {
      skipped.push({ sku, reason: "already exists" });
      continue;
    }

    try {
      const item = await prisma.inventoryItem.create({
        data: { name, sku, quantity, priceCents, costCents },
      });
      created.push({ sku: item.sku, name: item.name });
    } catch {
      errors.push({ sku, error: "Failed to create" });
    }
  }

  await logAudit({
    actorEmail,
    action: `inventory_import: ${created.length} created, ${skipped.length} skipped, ${errors.length} errors${viaToken ? " (via import token)" : ""}`,
  });

  return NextResponse.json({
    summary: { created: created.length, skipped: skipped.length, errors: errors.length },
    created,
    skipped,
    errors,
  });
}

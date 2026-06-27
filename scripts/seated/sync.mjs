// Push parsed Seated items into the dashboard inventory via the import endpoint.
//
// Reads a JSON array of items (output of parse.mjs) and POSTs them to
// /api/admin/inventory/import using a service token.
//
// Env:
//   DASHBOARD_BASE_URL       e.g. https://app.5starmediaprod.com (default http://localhost:3000)
//   INVENTORY_IMPORT_TOKEN   must match the value configured on the server
//
// Usage: node scripts/seated/sync.mjs <items.json>

import fs from "node:fs";

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: node scripts/seated/sync.mjs <items.json>");
  process.exit(1);
}

const baseUrl = (process.env.DASHBOARD_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const token = process.env.INVENTORY_IMPORT_TOKEN;
if (!token) {
  console.error("INVENTORY_IMPORT_TOKEN is not set — refusing to sync.");
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(inPath, "utf8"));
if (!Array.isArray(items) || items.length === 0) {
  console.error("No items to sync.");
  process.exit(1);
}

// Only send the fields the endpoint cares about; keep the rich context out.
const payload = {
  items: items.map((it) => ({
    sku: it.sku,
    name: it.name,
    quantity: it.quantity ?? 1,
    priceCents: it.priceCents ?? 0,
  })),
};

const res = await fetch(`${baseUrl}/api/admin/inventory/import`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-import-token": token,
  },
  body: JSON.stringify(payload),
});

const text = await res.text();
if (!res.ok) {
  console.error(`Import failed (${res.status}): ${text}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(text);
} catch {
  console.error(`Unexpected response: ${text}`);
  process.exit(1);
}

const s = data.summary || {};
console.error(`Imported: ${s.created ?? 0} created, ${s.skipped ?? 0} skipped, ${s.errors ?? 0} errors`);
if (data.errors && data.errors.length) {
  for (const e of data.errors) console.error(`  ! ${e.sku}: ${e.error}`);
}

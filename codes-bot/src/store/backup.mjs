// Durable local backup of every code the bot has ever seen.
//
// This is the dependency-free safety net behind the Google Sheet: a JSON
// "ledger" (the source of truth for dedup) plus a human-readable CSV. The
// GitHub Action commits these back to the repo, so every run is version-stored
// and nothing is ever lost — even if the Sheet is unavailable.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = new URL("../../data/", import.meta.url).pathname;
const LEDGER = path.join(DATA_DIR, "codes.json");
const CSV = path.join(DATA_DIR, "codes.csv");

const COLUMNS = [
  ["artist", "Event / Artist"],
  ["date", "Date"],
  ["dateISO", "Date (ISO)"],
  ["venue", "Venue"],
  ["code", "Code"],
  ["sku", "SKU"],
  ["onSaleAt", "On-sale time"],
  ["buyLink", "Buy link"],
  ["source", "Source"],
  ["capturedAt", "Captured at"],
];

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Load the existing ledger (array of records). Returns [] if none yet. */
export function loadLedger() {
  try {
    const raw = fs.readFileSync(LEDGER, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function knownSkus(ledger) {
  return new Set((ledger || []).map((r) => r.sku));
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(records) {
  const header = COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const rows = (records || []).map((r) => COLUMNS.map(([k]) => csvCell(r[k])).join(","));
  return [header, ...rows].join("\n") + "\n";
}

/** Pure merge of new records into existing (deduped by SKU, sorted by date). */
export function mergeLedger(existing, newRecords) {
  const bySku = new Map();
  for (const r of existing || []) bySku.set(r.sku, r);
  for (const r of newRecords || []) if (!bySku.has(r.sku)) bySku.set(r.sku, r);

  return [...bySku.values()].sort((a, b) => {
    const ad = a.dateISO || "9999-99-99";
    const bd = b.dateISO || "9999-99-99";
    return ad === bd ? String(a.sku).localeCompare(b.sku) : ad.localeCompare(bd);
  });
}

/**
 * Merge new records into the ledger, then write codes.json and codes.csv.
 * Returns the full, sorted ledger.
 */
export function saveLedger(existing, newRecords) {
  ensureDir();
  const merged = mergeLedger(existing, newRecords);
  fs.writeFileSync(LEDGER, JSON.stringify(merged, null, 2) + "\n");
  fs.writeFileSync(CSV, toCsv(merged));
  return merged;
}

export const paths = { DATA_DIR, LEDGER, CSV };

// Build the master spreadsheet of Seated codes.
//
// Input: a JSON array of parsed items (output of parse.mjs).
// Output: a CSV file that Excel / Google Sheets open natively.
//
// CSV (not .xlsx) is intentional: it needs zero dependencies, is diff-friendly,
// and opens directly in Excel. Save-as .xlsx inside Excel if you want the
// native format.

import fs from "node:fs";

const COLUMNS = [
  ["artist", "Event / Artist"],
  ["date", "Date"],
  ["dateISO", "Date (ISO)"],
  ["venue", "Venue"],
  ["code", "Code (password)"],
  ["sku", "SKU"],
  ["onSaleAt", "On-sale time"],
  ["buyLink", "Buy link"],
  ["priceCents", "Price (cents)"],
  ["quantity", "Qty"],
];

function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function itemsToCsv(items) {
  const header = COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const rows = (items || []).map((it) =>
    COLUMNS.map(([key]) => csvCell(it[key])).join(",")
  );
  return [header, ...rows].join("\n") + "\n";
}

// ---- CLI ----------------------------------------------------------------
// Usage: node scripts/seated/build-sheet.mjs <items.json> [out.csv]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inPath, outPath = "data/exports/seated-codes.csv"] = process.argv;
  if (!inPath) {
    console.error("Usage: node scripts/seated/build-sheet.mjs <items.json> [out.csv]");
    process.exit(1);
  }
  const items = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const csv = itemsToCsv(items);
  fs.mkdirSync(outPath.replace(/\/[^/]*$/, "") || ".", { recursive: true });
  fs.writeFileSync(outPath, csv);
  console.error(`Wrote ${items.length} row(s) -> ${outPath}`);
}

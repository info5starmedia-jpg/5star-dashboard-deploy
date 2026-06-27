// Self-test for the Seated parser against real-shaped sample emails.
// Run: node scripts/seated/selftest.mjs
//
// Exits non-zero if any assertion fails, so it can gate CI.

import { parseSeatedEmail, toInventoryItem, parseEmails, toISODate } from "./parse.mjs";
import fs from "node:fs";

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    failures++;
  }
}

const emails = JSON.parse(
  fs.readFileSync(new URL("./fixtures.sample.json", import.meta.url), "utf8")
);

// --- The Strokes ---
const strokes = parseSeatedEmail(emails[0]);
check("strokes: parsed", !!strokes);
check("strokes: code = PFGN4J2C", strokes.code === "PFGN4J2C");
check("strokes: artist = The Strokes", strokes.artist === "The Strokes");
check("strokes: date = September 27, 2025", strokes.date === "September 27, 2025");
check("strokes: dateISO = 2025-09-27", strokes.dateISO === "2025-09-27");
check("strokes: venue = The Chelsea", strokes.venue === "The Chelsea");
check("strokes: buyLink captured", strokes.buyLink === "https://seated.link/qdfsbbi8g505");
check("strokes: onSaleAt captured", strokes.onSaleAt === "10:00 AM PDT");

const strokesItem = toInventoryItem(strokes);
check("strokes: sku = PFGN4J2C-2025-09-27", strokesItem.sku === "PFGN4J2C-2025-09-27");
check("strokes: name composed", strokesItem.name === "The Strokes — September 27, 2025 — The Chelsea");
check("strokes: qty 1", strokesItem.quantity === 1);
check("strokes: price 0", strokesItem.priceCents === 0);

// --- Lovejoy: same code, two different shows -> two distinct SKUs ---
const items = parseEmails(emails);
const lovejoySkus = items.filter((i) => i.code === "YOURINDECISION").map((i) => i.sku).sort();
check(
  "lovejoy: shared code yields two distinct SKUs",
  lovejoySkus.length === 2 &&
    lovejoySkus[0] === "YOURINDECISION-2025-10-18" &&
    lovejoySkus[1] === "YOURINDECISION-2025-10-19"
);

// --- "You're signed up" has no password -> skipped ---
check("signup email is skipped (no code)", parseSeatedEmail(emails[3]) === null);
check("parseEmails total sellable = 3", items.length === 3);

// --- date helper ---
check("toISODate handles January", toISODate("January 1, 2026") === "2026-01-01");
check("toISODate rejects junk", toISODate("not a date") === null);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll Seated parser checks passed.");

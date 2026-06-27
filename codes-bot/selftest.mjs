// Offline stability self-test for codes-bot.
// Run: node selftest.mjs   (no network, no credentials, no dependencies)
//
// Covers the deterministic core: parsing, cross-source dedupe, ledger merge,
// CSV, and config validation. The network adapters (Gmail/AYCD/Sheets) are
// exercised by a real credentialed run; this gates the logic that must never
// regress.

import { parseSeatedEmail, normalizeAycd, toRecord, parseBatch, filterNew, toISODate } from "./src/parse.mjs";
import { mergeLedger, toCsv, knownSkus } from "./src/store/backup.mjs";
import { loadConfig } from "./src/config.mjs";

let fails = 0;
function check(label, cond) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) fails++;
}

// ── Seated email parsing ─────────────────────────────────────────────────────
const strokes = parseSeatedEmail({
  subject: "Tickets go on sale soon! (The Strokes)",
  plaintextBody:
    "Tickets go on sale soon!\n\nGet ready! Tickets go on sale today at 10:00 AM PDT via the link below.\n\nUse password: PFGN4J2C\n\nBuy now\n\nhttps://seated.link/qdfsbbi8g505\n\nThe Strokes\n\nSeptember 27, 2025\n\nThe Chelsea\n",
});
check("seated: code", strokes.code === "PFGN4J2C");
check("seated: artist", strokes.artist === "The Strokes");
check("seated: dateISO", strokes.dateISO === "2025-09-27");
check("seated: venue", strokes.venue === "The Chelsea");
check("seated: onSaleAt", strokes.onSaleAt === "10:00 AM PDT");
check("seated: record sku", toRecord(strokes).sku === "PFGN4J2C-2025-09-27");

// ── No-password email is skipped ─────────────────────────────────────────────
check(
  "seated: signup skipped",
  parseSeatedEmail({ subject: "You're signed up!", plaintextBody: "You're signed up! Tickets go on sale soon." }) === null
);

// ── AYCD structured normalization ────────────────────────────────────────────
const aycd = normalizeAycd({ event: "Lovejoy", date: "October 18, 2025", venue: "Big Night Live", code: "YOURINDECISION" });
check("aycd: code", aycd.code === "YOURINDECISION");
check("aycd: record sku", toRecord(aycd).sku === "YOURINDECISION-2025-10-18");

// ── Cross-source dedupe (same code, two shows -> two records) ─────────────────
const batch = parseBatch([
  { kind: "seated", source: "gmail:a", subject: "(Lovejoy)", plaintextBody: "Use password: YOURINDECISION\nhttps://seated.link/x\nLovejoy\nOctober 18, 2025\nBig Night Live" },
  { kind: "seated", source: "gmail:b", subject: "(Lovejoy)", plaintextBody: "Use password: YOURINDECISION\nhttps://seated.link/y\nLovejoy\nOctober 19, 2025\nThéâtre Beanfield" },
  // exact duplicate of the first (e.g. same email in two inboxes) -> collapses
  { kind: "seated", source: "gmail:c", subject: "(Lovejoy)", plaintextBody: "Use password: YOURINDECISION\nhttps://seated.link/x\nLovejoy\nOctober 18, 2025\nBig Night Live" },
]);
check("batch: dedupes to 2", batch.length === 2);

// ── filterNew against known SKUs ─────────────────────────────────────────────
const known = new Set(["YOURINDECISION-2025-10-18"]);
check("filterNew: drops known", filterNew(batch, known).length === 1);

// ── Ledger merge is idempotent ───────────────────────────────────────────────
const m1 = mergeLedger([], batch);
const m2 = mergeLedger(m1, batch); // re-adding the same -> no growth
check("ledger: merge dedupes", m1.length === 2 && m2.length === 2);
check("ledger: sorted by date", m1[0].dateISO === "2025-10-18" && m1[1].dateISO === "2025-10-19");
check("ledger: knownSkus", knownSkus(m1).has("YOURINDECISION-2025-10-19"));

// ── CSV ──────────────────────────────────────────────────────────────────────
const csv = toCsv(m1);
check("csv: header + 2 rows", csv.trim().split("\n").length === 3);
check("csv: contains code", csv.includes("YOURINDECISION"));

// ── Config validation degrades gracefully ────────────────────────────────────
const empty = loadConfig({});
check("config: nothing enabled when empty", !empty.enabled.gmail && !empty.enabled.aycd && !empty.enabled.sheet);
check("config: reports missing", empty.missing.length === 3);

const partial = loadConfig({
  GMAIL_ACCOUNTS: JSON.stringify([{ user: "x@gmail.com", appPassword: "aaaa bbbb cccc dddd" }]),
  AYCD_INBOX_TOKEN: "tok",
});
check("config: gmail parsed", partial.enabled.gmail && partial.gmailAccounts[0].appPassword === "aaaabbbbccccdddd");
check("config: aycd enabled", partial.enabled.aycd);
check("config: sheet still missing", !partial.enabled.sheet);

if (fails > 0) {
  console.error(`\n${fails} check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll codes-bot stability checks passed.");

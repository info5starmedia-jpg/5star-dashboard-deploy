// Parser for Seated (support@seated.com) "Tickets go on sale soon!" emails.
//
// These emails announce an artist presale and contain a one-time presale
// PASSWORD ("Use password: XXXX"). We extract the artist, show date, venue,
// the password (the sellable "code"), the buy link, and the on-sale time.
//
// Emails WITHOUT a password (e.g. the earlier "You're signed up!" confirmation)
// are intentionally skipped — they carry no code, so there is nothing to sell.
//
// The parser is pure and dependency-free so it can run under plain `node` and
// be unit-tested (see selftest.mjs). The agent dumps raw Seated emails (subject
// + plaintextBody) to JSON and pipes them through this module.

const PASSWORD_RE = /Use password:\s*([^\s]+)/i;
const SEATED_LINK_RE = /https?:\/\/seated\.link\/\S+/i;
const ONSALE_RE = /on sale\s+(?:today\s+)?(?:on\s+)?(?:at\s+)?(.+?)\s+via the link below/i;

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/**
 * Convert a human date like "September 27, 2025" to ISO "2025-09-27".
 * Returns null if the string does not look like a Month DD, YYYY date.
 */
export function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = m[2].padStart(2, "0");
  return `${m[3]}-${month}-${day}`;
}

/** Lowercase, hyphenate, strip punctuation — for building stable SKUs. */
export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a single Seated email.
 * @param {{subject?: string, plaintextBody?: string, body?: string}} input
 * @returns {null | {
 *   artist: string|null, date: string|null, dateISO: string|null,
 *   venue: string|null, code: string, buyLink: string|null,
 *   onSaleAt: string|null, subject: string
 * }}
 */
export function parseSeatedEmail(input) {
  const subject = String(input?.subject || "").trim();
  const body = String(input?.plaintextBody || input?.body || "").replace(/\r\n/g, "\n");

  const pw = body.match(PASSWORD_RE);
  if (!pw) return null; // no password -> not a sellable "on sale" email
  const code = pw[1].trim();

  const linkMatch = body.match(SEATED_LINK_RE);
  const buyLink = linkMatch ? linkMatch[0] : null;

  // The artist / date / venue render as three consecutive lines directly after
  // the "Buy now" link. Drop blank lines and bare URLs, then read the first
  // three remaining lines after the buy-link line.
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  let artist = null;
  let date = null;
  let venue = null;
  const linkIdx = lines.findIndex((l) => /seated\.link\//i.test(l));
  if (linkIdx !== -1) {
    const after = lines.slice(linkIdx + 1).filter((l) => !/^https?:\/\//i.test(l));
    artist = after[0] || null;
    date = after[1] || null;
    venue = after[2] || null;
  }

  // Fallback: pull the artist from the subject "... (Artist)".
  if (!artist) {
    const m = subject.match(/\(([^)]+)\)\s*$/);
    if (m) artist = m[1].trim();
  }

  // If the line we guessed as "date" is not actually a date, treat it as missing.
  const dateISO = toISODate(date);
  if (!dateISO) {
    // Some layouts may shift lines; try to find a date among the candidate lines.
    const candidates = lines.slice(linkIdx + 1).filter((l) => !/^https?:\/\//i.test(l));
    const foundISO = candidates.map(toISODate).find(Boolean);
    if (foundISO) {
      const di = candidates.findIndex((l) => toISODate(l) === foundISO);
      artist = artist || candidates[di - 1] || null;
      date = candidates[di];
      venue = candidates[di + 1] || venue;
    }
  }

  const onsale = body.match(ONSALE_RE);
  const onSaleAt = onsale ? onsale[1].trim() : null;

  return {
    artist,
    date,
    dateISO: toISODate(date),
    venue,
    code,
    buyLink,
    onSaleAt,
    subject,
  };
}

/**
 * Map a parsed Seated email to a dashboard inventory item.
 *
 * SKU is a composite of the code + show date because a single presale password
 * can be reused across multiple shows (observed: "YOURINDECISION" for two
 * Lovejoy dates). The composite keeps each show a distinct, idempotent line.
 *
 * priceCents defaults to 0 — price is demand-based and set per code in the
 * dashboard. quantity is 1 (each code sells once).
 */
export function toInventoryItem(parsed) {
  if (!parsed) return null;
  const datePart = parsed.dateISO || slug(parsed.date) || "tbd";
  const sku = `${parsed.code}-${datePart}`;
  const namePieces = [parsed.artist, parsed.date, parsed.venue].filter(Boolean);
  const name = namePieces.join(" — ") || `Seated code ${parsed.code}`;
  return {
    sku,
    name,
    quantity: 1,
    priceCents: 0,
    // passthrough context (ignored by the import endpoint, useful for the sheet)
    code: parsed.code,
    artist: parsed.artist,
    date: parsed.date,
    dateISO: parsed.dateISO,
    venue: parsed.venue,
    buyLink: parsed.buyLink,
    onSaleAt: parsed.onSaleAt,
  };
}

/**
 * Parse an array of raw emails into deduped inventory items.
 * @param {Array<{subject?:string, plaintextBody?:string}>} emails
 */
export function parseEmails(emails) {
  const seen = new Set();
  const items = [];
  for (const email of emails || []) {
    const parsed = parseSeatedEmail(email);
    if (!parsed) continue;
    const item = toInventoryItem(parsed);
    if (seen.has(item.sku)) continue;
    seen.add(item.sku);
    items.push(item);
  }
  return items;
}

// ---- CLI ----------------------------------------------------------------
// Usage: node scripts/seated/parse.mjs <raw-emails.json> [out-items.json]
// Reads a JSON array of { subject, plaintextBody } and writes parsed items.
// With no out file, prints items JSON to stdout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , inPath, outPath] = process.argv;
  if (!inPath) {
    console.error("Usage: node scripts/seated/parse.mjs <raw-emails.json> [out-items.json]");
    process.exit(1);
  }
  const fs = await import("node:fs");
  const raw = JSON.parse(fs.readFileSync(inPath, "utf8"));
  const emails = Array.isArray(raw) ? raw : raw.emails || [];
  const items = parseEmails(emails);
  const json = JSON.stringify(items, null, 2);
  if (outPath) {
    fs.writeFileSync(outPath, json);
    console.error(`Parsed ${items.length} sellable code(s) -> ${outPath}`);
  } else {
    process.stdout.write(json + "\n");
  }
}

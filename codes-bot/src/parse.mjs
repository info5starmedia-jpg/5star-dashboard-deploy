// Canonical code parser for the codes-bot.
//
// Normalizes presale codes from multiple sources (Seated emails across several
// Gmail inboxes, and AYCD Inbox) into one consistent record shape so they can
// be deduped and written to the master sheet.
//
// Pure and dependency-free → runnable under plain `node` and unit-tested
// (see selftest.mjs). Network/credential concerns live in src/sources/*.

const PASSWORD_RE = /Use password:\s*([^\s]+)/i;
const GENERIC_CODE_RE = /\b(?:password|presale\s*code|access\s*code|code)\s*[:\-]\s*([A-Z0-9][A-Z0-9._-]{3,})/i;
const SEATED_LINK_RE = /https?:\/\/seated\.link\/\S+/i;
const ONSALE_RE = /on sale\s+(?:today\s+)?(?:on\s+)?(?:at\s+)?(.+?)\s+via the link below/i;

const MONTHS = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

/** "September 27, 2025" -> "2025-09-27"; null if not a recognizable date. */
export function toISODate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${String(m[2]).padStart(2, "0")}`;
}

export function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a Seated "Tickets go on sale soon!" email body.
 * Returns null when there is no password (nothing sellable).
 */
export function parseSeatedEmail(input) {
  const subject = String(input?.subject || "").trim();
  const body = String(input?.plaintextBody || input?.body || "").replace(/\r\n/g, "\n");

  const pw = body.match(PASSWORD_RE) || body.match(GENERIC_CODE_RE);
  if (!pw) return null;
  const code = pw[1].trim();

  const linkMatch = body.match(SEATED_LINK_RE);
  const buyLink = linkMatch ? linkMatch[0] : null;

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
  if (!artist) {
    const m = subject.match(/\(([^)]+)\)\s*$/);
    if (m) artist = m[1].trim();
  }
  // Recover the date if our positional guess wasn't actually a date.
  if (!toISODate(date) && linkIdx !== -1) {
    const cands = lines.slice(linkIdx + 1).filter((l) => !/^https?:\/\//i.test(l));
    const iso = cands.map(toISODate).find(Boolean);
    if (iso) {
      const di = cands.findIndex((l) => toISODate(l) === iso);
      artist = artist || cands[di - 1] || null;
      date = cands[di];
      venue = cands[di + 1] || venue;
    }
  }

  const onsale = body.match(ONSALE_RE);
  return {
    artist,
    date,
    dateISO: toISODate(date),
    venue,
    code,
    buyLink,
    onSaleAt: onsale ? onsale[1].trim() : null,
    subject,
  };
}

/**
 * Normalize an already-structured AYCD Inbox code record into our shape.
 * AYCD hands back fields directly (no email body to scrape), so we map them.
 */
export function normalizeAycd(item) {
  if (!item) return null;
  const code = String(item.code || item.password || item.value || "").trim();
  if (!code) return null;
  const date = item.date || item.eventDate || null;
  return {
    artist: item.event || item.artist || item.title || null,
    date,
    dateISO: toISODate(date),
    venue: item.venue || item.location || null,
    code,
    buyLink: item.link || item.url || null,
    onSaleAt: item.onSaleAt || item.saleTime || null,
    subject: item.subject || null,
  };
}

/**
 * Turn a parsed record into the canonical sheet/inventory record.
 * SKU = CODE-YYYY-MM-DD so one password reused across shows stays distinct,
 * and re-runs dedupe cleanly. Falls back to a slug of the event when no date.
 */
export function toRecord(parsed, meta = {}) {
  if (!parsed) return null;
  const datePart = parsed.dateISO || slug(parsed.date) || slug(parsed.artist) || "tbd";
  const sku = `${parsed.code}-${datePart}`;
  const name = [parsed.artist, parsed.date, parsed.venue].filter(Boolean).join(" — ") ||
    `Code ${parsed.code}`;
  return {
    sku,
    name,
    code: parsed.code,
    artist: parsed.artist || null,
    date: parsed.date || null,
    dateISO: parsed.dateISO || null,
    venue: parsed.venue || null,
    onSaleAt: parsed.onSaleAt || null,
    buyLink: parsed.buyLink || null,
    source: meta.source || null,
    capturedAt: meta.capturedAt || null,
  };
}

/**
 * Parse a batch of raw inputs into deduped records.
 * Each input: { kind: 'seated'|'aycd', source, capturedAt, ...payload }
 *   seated payload: { subject, plaintextBody }
 *   aycd payload:   the structured AYCD item
 */
export function parseBatch(inputs) {
  const seen = new Set();
  const records = [];
  for (const input of inputs || []) {
    let parsed = null;
    if (input?.kind === "aycd") parsed = normalizeAycd(input.item || input);
    else parsed = parseSeatedEmail(input);
    if (!parsed) continue;
    const rec = toRecord(parsed, { source: input?.source, capturedAt: input?.capturedAt });
    if (!rec || seen.has(rec.sku)) continue;
    seen.add(rec.sku);
    records.push(rec);
  }
  return records;
}

/** Deduplicate `incoming` against a set of SKUs already known. */
export function filterNew(incoming, knownSkus) {
  const known = knownSkus instanceof Set ? knownSkus : new Set(knownSkus || []);
  return (incoming || []).filter((r) => r && !known.has(r.sku));
}

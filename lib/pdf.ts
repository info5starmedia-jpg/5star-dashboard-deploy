export type InvoicePdfItem = {
  description: string;
  sku?: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

export type InvoicePdfInput = {
  id: string;
  createdAt: Date;
  createdByEmail: string;
  customerEmail?: string | null;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: InvoicePdfItem[];
};

// Page geometry constants
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 72;
const START_Y = 720;
const LINE_HEIGHT = 14;
const BOTTOM_MARGIN = 72;
const LINES_PER_PAGE = Math.floor((START_Y - BOTTOM_MARGIN) / LINE_HEIGHT); // ~46

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

/** Build a single page content stream from an array of text lines. */
function buildPageContent(lines: string[]): string {
  const ops = lines.map((line) => `(${escapePdfText(line)}) Tj`);
  return [
    "BT",
    "/F1 12 Tf",
    `${LINE_HEIGHT} TL`,
    `1 0 0 1 ${MARGIN_LEFT} ${START_Y} Tm`,
    ops[0] ?? "",
    ...ops.slice(1).map((op) => `T*\n${op}`),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Build a valid PDF 1.4 document from one or more page content streams.
 * Supports unlimited pages — each entry in `pageContents` becomes one page.
 */
function buildPdf(pageContents: string[]): Buffer {
  if (pageContents.length === 0) pageContents = [""];

  const pageCount = pageContents.length;

  // Object numbering:
  //  1        → Catalog
  //  2        → Pages (dictionary)
  //  3..N     → Page objects        (pageCount items)
  //  N+1..M   → Content streams     (pageCount items)
  //  M+1      → Font
  const pageObjStart = 3;
  const contentObjStart = 3 + pageCount;
  const fontObjNum = 3 + 2 * pageCount;
  const totalObjs = fontObjNum;

  const kidsRef = Array.from(
    { length: pageCount },
    (_, i) => `${pageObjStart + i} 0 R`
  ).join(" ");

  const objects: string[] = [];

  // 1: Catalog
  objects.push(`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`);

  // 2: Pages
  objects.push(
    `2 0 obj << /Type /Pages /Kids [${kidsRef}] /Count ${pageCount} >> endobj`
  );

  // Page objects
  for (let i = 0; i < pageCount; i++) {
    objects.push(
      `${pageObjStart + i} 0 obj << /Type /Page /Parent 2 0 R` +
        ` /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]` +
        ` /Contents ${contentObjStart + i} 0 R` +
        ` /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >> endobj`
    );
  }

  // Content streams
  for (let i = 0; i < pageCount; i++) {
    const stream = pageContents[i];
    const len = Buffer.byteLength(stream, "utf8");
    objects.push(
      `${contentObjStart + i} 0 obj << /Length ${len} >> stream\n${stream}\nendstream endobj`
    );
  }

  // Font
  objects.push(
    `${fontObjNum} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`
  );

  // Assemble raw PDF bytes
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${totalObjs + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 0; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Size ${totalObjs + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function generateInvoicePdf(input: InvoicePdfInput): Buffer {
  // Build the full list of text lines
  const lines: string[] = [
    `Invoice ${input.id}`,
    `Created: ${input.createdAt.toISOString()}`,
    `Created by: ${input.createdByEmail}`,
    `Customer: ${input.customerEmail || "N/A"}`,
    " ",
    "Items:",
  ];

  for (const item of input.lineItems) {
    const skuPart = item.sku ? ` [${item.sku}]` : "";
    lines.push(
      `${item.description}${skuPart}  x${item.quantity} @ ${formatMoney(
        item.unitPriceCents
      )} = ${formatMoney(item.totalCents)}`
    );
  }

  lines.push(" ");
  lines.push(`Subtotal: ${formatMoney(input.subtotalCents)}`);
  lines.push(`Tax:      ${formatMoney(input.taxCents)}`);
  lines.push(`Total:    ${formatMoney(input.totalCents)}`);

  // Split lines into pages (~46 lines each)
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }

  const pageContents = pages.map(buildPageContent);
  return buildPdf(pageContents);
}

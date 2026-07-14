// Google Sheet store — appends new codes to the master sheet via a service
// account, and reads back existing SKUs so we never write a duplicate.
//
// The sheet column order matches the CSV backup exactly:
//   A Artist | B Date | C Date(ISO) | D Venue | E Code | F SKU |
//   G On-sale | H Buy link | I Source | J Captured at
// SKU is column F, which is what readExistingSkus checks.

import { google } from "googleapis";

const HEADER = [
  "Event / Artist", "Date", "Date (ISO)", "Venue", "Code",
  "SKU", "On-sale time", "Buy link", "Source", "Captured at",
];

function sheetsApi(serviceAccountJson) {
  const creds = JSON.parse(serviceAccountJson);
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function rowFor(r) {
  return [
    r.artist, r.date, r.dateISO, r.venue, r.code,
    r.sku, r.onSaleAt, r.buyLink, r.source, r.capturedAt,
  ].map((v) => (v === null || v === undefined ? "" : String(v)));
}

/** Read column F (SKU) so we can dedupe before appending. */
export async function readExistingSkus(sheet) {
  const api = sheetsApi(sheet.serviceAccountJson);
  let res;
  try {
    res = await api.spreadsheets.values.get({
      spreadsheetId: sheet.spreadsheetId,
      range: `${sheet.tabName}!F:F`,
    });
  } catch (e) {
    // 400 typically means the tab doesn't exist yet — treat as empty.
    if (e?.code === 400) return new Set();
    throw e;
  }
  const vals = (res?.data?.values || []).flat().filter(Boolean);
  return new Set(vals.filter((s) => s !== "SKU"));
}

async function ensureHeader(api, sheet) {
  const res = await api.spreadsheets.values
    .get({ spreadsheetId: sheet.spreadsheetId, range: `${sheet.tabName}!A1:J1` })
    .catch(() => null);
  const hasHeader = res?.data?.values?.[0]?.length;
  if (!hasHeader) {
    await api.spreadsheets.values.update({
      spreadsheetId: sheet.spreadsheetId,
      range: `${sheet.tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }
}

/** Append new records (caller has already deduped). Returns { appended }. */
export async function appendRecords(sheet, records) {
  if (!records || records.length === 0) return { appended: 0 };
  const api = sheetsApi(sheet.serviceAccountJson);
  await ensureHeader(api, sheet);
  await api.spreadsheets.values.append({
    spreadsheetId: sheet.spreadsheetId,
    range: `${sheet.tabName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: records.map(rowFor) },
  });
  return { appended: records.length };
}

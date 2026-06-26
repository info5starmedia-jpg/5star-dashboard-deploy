# Seated → Inventory agent

Turn the presale **codes** that arrive from `support@seated.com` into sellable
inventory in the dashboard, and keep a master spreadsheet of every code.

## What it does

1. **Reads** the Seated emails in the connected Gmail inbox.
2. **Parses** each "Tickets go on sale soon!" email into: artist/event, date,
   venue, the presale **password (the code)**, the buy link, and the on-sale
   time. Emails without a password (e.g. the "You're signed up!" confirmations)
   are skipped — they have nothing to sell.
3. **Writes** a master spreadsheet (CSV, opens in Excel/Sheets) of all codes.
4. **Pushes** each code into the dashboard as an `InventoryItem` so it shows up
   to sell.

### How a code maps to inventory

| Field | Value |
|---|---|
| `sku` | `<CODE>-<YYYY-MM-DD>` (e.g. `PFGN4J2C-2025-09-27`) |
| `name` | `<Artist> — <Date> — <Venue>` |
| `quantity` | `1` (each code sells once) |
| `priceCents` | `0` — **price is set per code in the dashboard** (demand-based) |

The SKU is a composite of code **and** show date on purpose: Seated reuses one
password across multiple shows (observed: `YOURINDECISION` for two Lovejoy
dates), so the show date is what makes each listing unique. Re-running a scan is
idempotent — a SKU that already exists is skipped, never duplicated.

## How to run it (agent-driven)

You task the agent — "scan Seated and sync now" — and it runs the steps below.
There is no permanent server cron; it runs when you ask, until you say stop.

The deterministic pieces are scripts so the logic is testable and repeatable:

```bash
# 0. (once) verify the parser still matches Seated's format
npm run seated:selftest

# 1. Agent dumps raw Seated emails to JSON: [{ subject, plaintextBody }, ...]
#    (gmail search: from:support@seated.com "Use password")
#    -> data/exports/seated-raw.json

# 2. Parse raw emails into structured items (skips no-code emails, dedupes)
npm run seated:parse data/exports/seated-raw.json data/exports/seated-items.json

# 3. Build the master spreadsheet
npm run seated:sheet data/exports/seated-items.json data/exports/seated-codes.csv

# 4. Push the codes into the dashboard inventory
DASHBOARD_BASE_URL=https://app.5starmediaprod.com \
INVENTORY_IMPORT_TOKEN=<your-token> \
  npm run seated:sync data/exports/seated-items.json
```

## Server setup (one time)

The import endpoint accepts either a logged-in **admin session** or a service
token, so automation can push without a browser login.

Add to the dashboard's `.env`:

```
INVENTORY_IMPORT_TOKEN=<a long random secret>
```

Generate one with: `openssl rand -hex 32`

The endpoint is `POST /api/admin/inventory/import`:

```jsonc
// Request
{ "items": [ { "sku": "PFGN4J2C-2025-09-27", "name": "The Strokes — September 27, 2025 — The Chelsea", "quantity": 1, "priceCents": 0 } ] }

// Response
{ "summary": { "created": 1, "skipped": 0, "errors": 0 }, "created": [...], "skipped": [...], "errors": [...] }
```

Auth: send header `x-import-token: <INVENTORY_IMPORT_TOKEN>` (or call it while
signed in as an admin). Without either, it returns `403`.

## Setting prices

Codes import at price `0` by design — open `/admin/inventory` and set the price
per code based on demand. Editing price/quantity there is unchanged.

## A note on terms of service

Seated presale passwords are distributed free to fans to access presales.
Reselling them may conflict with Seated's or the venue's terms. This tooling
automates *your* workflow; whether to sell the codes is your call.

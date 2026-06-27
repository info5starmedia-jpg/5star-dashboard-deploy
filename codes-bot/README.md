# codes-bot

Scrapes presale **codes** from multiple **Gmail inboxes** and **AYCD Inbox**,
deduplicates them, and writes them to a master **Google Sheet** — with a
version-controlled local backup so the data is never lost.

It runs as a **GitHub Action** (no private server needed). You trigger it on
demand, or uncomment the schedule to run it automatically.

```
4 Gmail inboxes ─┐
                 ├─►  codes-bot  ─►  Google Sheet (syncs to your desktop via Drive)
AYCD Inbox API ──┘                └─►  data/codes.json + codes.csv (git backup)
```

## Why this design is dependable

- **Three copies of every code:** the Google Sheet (cloud, with version
  history), your desktop (via Google Drive for Desktop), and this repo's
  `data/` ledger (git history). Lose one, two remain.
- **Idempotent:** every code has a stable SKU (`CODE-YYYY-MM-DD`). Re-running
  never creates duplicates — already-seen codes are skipped.
- **Fault-isolated:** if one inbox or AYCD fails, the others still run and the
  run still succeeds. Codes are written to the local ledger *before* the Sheet,
  so a Sheets outage can't lose data.
- **Self-testing:** the Action runs `selftest.mjs` (offline) before every scrape
  and stops if the core logic regresses.

## One-time setup (all secrets live in GitHub → Settings → Secrets → Actions)

| Secret | What it is |
|---|---|
| `GMAIL_ACCOUNTS` | JSON array: `[{"user":"a@gmail.com","appPassword":"xxxx xxxx xxxx xxxx"}, …]` — use Gmail **App Passwords**, one per inbox |
| `SENDERS` | *(optional)* comma-separated From-address filters; default `seated.com` |
| `AYCD_INBOX_TOKEN` | Your AYCD Inbox API bearer token |
| `AYCD_INBOX_BASE_URL` / `AYCD_INBOX_MAIL_PATH` | *(optional)* override the AYCD endpoint if needed |
| `SHEET_ID` | The Google Sheet ID (from its URL) |
| `SHEET_TAB` | *(optional)* tab name, default `Codes` |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The full service-account JSON key (share the Sheet with the service-account email) |
| `LOOKBACK_DAYS` | *(optional)* how many days back to scan, default `30` |

### Getting each piece
- **Gmail App Password:** Google Account → Security → 2-Step Verification → App
  passwords. Generate one per inbox. (App passwords work over IMAP; they're
  revocable and safer than your real password.)
- **Google service account + Sheet:** create a service account in Google Cloud,
  download its JSON key, then **share your Sheet with the service account's
  email** (Editor). The bot can then touch *only that one sheet*.
- **Google Drive for Desktop:** install it and keep the Sheet in a synced
  folder — it then mirrors to your computer automatically.
- **AYCD token:** from your AYCD Inbox account.

## Run it

- **On demand:** GitHub → **Actions** → **codes-scraper** → **Run workflow**.
- **Automatic:** uncomment the `schedule:` block in
  `.github/workflows/codes-scraper.yml`.

## Local testing

```bash
cd codes-bot
cp .env.example .env     # fill in what you want to test
npm install
npm run selftest         # offline logic checks (no creds needed)
npm start                # real run using .env
```

## Layout

```
codes-bot/
  src/
    index.mjs          orchestrator (gather → parse → dedupe → store)
    config.mjs         env config loader + validation
    parse.mjs          code parser/normalizer (Seated emails + AYCD)
    sources/
      gmail.mjs        IMAP reader (App Passwords)
      aycd.mjs         AYCD Inbox API client
    store/
      sheet.mjs        Google Sheet append + SKU dedupe
      backup.mjs       data/codes.json + codes.csv ledger
  selftest.mjs         offline stability tests
  data/                committed ledger (recovery backup)
```

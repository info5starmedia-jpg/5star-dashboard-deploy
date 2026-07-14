// Configuration loader + validator for the codes-bot.
//
// All secrets come from environment variables (GitHub Actions Secrets in prod,
// a local .env for testing). This module never throws on missing config — it
// reports what is enabled vs missing so a run degrades gracefully instead of
// crashing (one missing source must not take the whole bot down).

function clean(v) {
  return (v || "").toString().replace(/^["']|["']$/g, "").trim();
}

/**
 * Gmail accounts are configured as a JSON array in GMAIL_ACCOUNTS, e.g.:
 *   [{"user":"a@gmail.com","appPassword":"xxxx xxxx xxxx xxxx"}, ...]
 * App passwords are 16 chars (spaces optional). Up to any number of accounts.
 */
function parseGmailAccounts(raw) {
  const text = clean(raw);
  if (!text) return [];
  let arr;
  try {
    arr = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => ({
      user: clean(a.user),
      appPassword: clean(a.appPassword).replace(/\s+/g, ""),
      host: clean(a.host) || "imap.gmail.com",
      port: Number(a.port) || 993,
    }))
    .filter((a) => a.user && a.appPassword);
}

export function loadConfig(env = process.env) {
  const gmailAccounts = parseGmailAccounts(env.GMAIL_ACCOUNTS);

  const aycd = {
    token: clean(env.AYCD_INBOX_TOKEN),
    baseUrl: clean(env.AYCD_INBOX_BASE_URL) || "https://useapi.useinbox.com",
    // Endpoint that returns recently captured mail/codes. Overridable because
    // AYCD's exact path is confirmed at wiring time against your account.
    mailPath: clean(env.AYCD_INBOX_MAIL_PATH) || "/v1/mail",
  };

  const sheet = {
    spreadsheetId: clean(env.SHEET_ID),
    tabName: clean(env.SHEET_TAB) || "Codes",
    // Service-account JSON, pasted whole into one secret.
    serviceAccountJson: clean(env.GOOGLE_SERVICE_ACCOUNT_JSON),
  };

  // How far back to look on each run (days). Keeps runs fast + idempotent.
  const lookbackDays = Number(clean(env.LOOKBACK_DAYS)) || 30;

  // From-address substrings to keep when scanning Gmail (comma-separated).
  const senders = clean(env.SENDERS)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const enabled = {
    gmail: gmailAccounts.length > 0,
    aycd: Boolean(aycd.token),
    sheet: Boolean(sheet.spreadsheetId && sheet.serviceAccountJson),
  };

  const missing = [];
  if (!enabled.gmail) missing.push("GMAIL_ACCOUNTS (no valid Gmail accounts)");
  if (!enabled.aycd) missing.push("AYCD_INBOX_TOKEN");
  if (!enabled.sheet) missing.push("SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON");

  return { gmailAccounts, aycd, sheet, lookbackDays, senders, enabled, missing };
}

/** True when at least one input source is usable. */
export function hasAnySource(config) {
  return config.enabled.gmail || config.enabled.aycd;
}

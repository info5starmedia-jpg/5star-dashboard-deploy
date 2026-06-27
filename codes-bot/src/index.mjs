// codes-bot orchestrator.
//
// Flow: gather raw codes from every configured source (each isolated so one
// failure can't sink the run) -> parse + dedupe -> write the local ledger
// backup -> append the new ones to the Google Sheet. Always exits 0 unless
// something truly catastrophic happens, so a scheduled run never "fails red"
// just because one inbox hiccupped.

import { loadConfig, hasAnySource } from "./config.mjs";
import { parseBatch, filterNew } from "./parse.mjs";
import { loadLedger, knownSkus, saveLedger } from "./store/backup.mjs";
import { fetchFromGmail } from "./sources/gmail.mjs";
import { fetchFromAycd } from "./sources/aycd.mjs";
import { appendRecords, readExistingSkus } from "./store/sheet.mjs";

function log(...args) {
  console.log("[codes-bot]", ...args);
}

export async function run() {
  const config = loadConfig();

  log(
    `sources enabled — gmail:${config.enabled.gmail} (${config.gmailAccounts.length} acct), ` +
      `aycd:${config.enabled.aycd}, sheet:${config.enabled.sheet}`
  );
  if (config.missing.length) log("not configured:", config.missing.join("; "));

  if (!hasAnySource(config)) {
    log("no input sources configured — nothing to do. Exiting cleanly.");
    return { ok: true, fresh: 0, reason: "no-sources" };
  }

  // ── Gather (each source isolated) ──────────────────────────────────────────
  const inputs = [];
  for (const account of config.gmailAccounts) {
    try {
      const got = await fetchFromGmail(account, {
        lookbackDays: config.lookbackDays,
        senders: config.senders,
      });
      log(`gmail ${account.user}: ${got.length} message(s)`);
      inputs.push(...got);
    } catch (e) {
      log(`gmail ${account.user} FAILED: ${e.message}`);
    }
  }
  if (config.enabled.aycd) {
    try {
      const got = await fetchFromAycd(config.aycd, { lookbackDays: config.lookbackDays });
      log(`aycd: ${got.length} item(s)`);
      inputs.push(...got);
    } catch (e) {
      log(`aycd FAILED: ${e.message}`);
    }
  }

  // ── Parse + dedupe ─────────────────────────────────────────────────────────
  const parsed = parseBatch(inputs);
  log(`parsed ${parsed.length} unique code(s) from ${inputs.length} input(s)`);

  const ledger = loadLedger();
  const known = knownSkus(ledger);
  if (config.enabled.sheet) {
    try {
      const sheetSkus = await readExistingSkus(config.sheet);
      for (const s of sheetSkus) known.add(s);
      log(`sheet already has ${sheetSkus.size} code(s)`);
    } catch (e) {
      log(`sheet read FAILED (will rely on local ledger): ${e.message}`);
    }
  }

  const fresh = filterNew(parsed, known);
  log(`${fresh.length} new code(s) this run`);

  // ── Persist: local ledger first (safety net), then the sheet ───────────────
  const merged = saveLedger(ledger, fresh);
  log(`ledger now holds ${merged.length} code(s) (backup written to data/)`);

  if (config.enabled.sheet && fresh.length) {
    try {
      const { appended } = await appendRecords(config.sheet, fresh);
      log(`appended ${appended} row(s) to Google Sheet`);
    } catch (e) {
      log(`sheet append FAILED (codes are safe in the local ledger): ${e.message}`);
    }
  }

  log("done.");
  return { ok: true, fresh: fresh.length, total: merged.length };
}

// Run when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((e) => {
    console.error("[codes-bot] fatal:", e);
    process.exit(1);
  });
}

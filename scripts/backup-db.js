/* eslint-disable @typescript-eslint/no-require-imports, no-console */
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(__dirname, "..", "data", "app.db");
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const backupDir = path.resolve(__dirname, "..", "data", "backups");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `app-${stamp}.db`);

fs.copyFileSync(dbPath, backupPath);
console.log(`Backup created: ${backupPath}`);

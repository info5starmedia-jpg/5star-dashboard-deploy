/* eslint-disable @typescript-eslint/no-require-imports, no-console */
// WAL-safe SQLite backup with rotation. Run inside the container (has
// DATABASE_URL): `npm run backup:db`. Uses `VACUUM INTO`, which writes a
// fully-consistent standalone snapshot regardless of WAL state — no torn
// copies, and it defragments too. Snapshots land in the bind-mounted
// data/backups/ dir, so they persist on the host across container rebuilds.
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "app.db");
const backupDir = path.join(dataDir, "backups");
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 30)); // snapshots to retain

async function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
  }
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = path.join(backupDir, `app-${stamp}.db`);

  const prisma = new PrismaClient();
  try {
    // Single-quote-escape the path for the SQL string literal.
    await prisma.$executeRawUnsafe(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  } finally {
    await prisma.$disconnect();
  }

  const kb = (fs.statSync(out).size / 1024).toFixed(0);
  console.log(`Backup created: ${out} (${kb} KB)`);

  // Rotation — keep the newest KEEP snapshots. ISO timestamps sort chronologically.
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => /^app-.*\.db$/.test(f))
    .sort();
  const excess = files.slice(0, Math.max(0, files.length - KEEP));
  for (const f of excess) fs.unlinkSync(path.join(backupDir, f));
  if (excess.length) console.log(`Pruned ${excess.length} old backup(s); keeping newest ${KEEP}.`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});

#!/usr/bin/env bash
# ============================================================================
#  5Star / Viking Essentials dashboard — Gold production deploy
#  SAFE BY DESIGN: refuses to run anywhere except the Gold server.
#  Preserves .env + data/ (live DB + 6902 inventory). No git clean.
# ============================================================================
set -uo pipefail

# ---- HARD GUARD 1: must be the Gold server ----
HN="$(hostname 2>/dev/null || echo unknown)"
if [ "$HN" != "Proxyserver" ]; then
  echo "!!! ABORT: hostname is '$HN', not 'Proxyserver'."
  echo "!!! This script only runs on the Gold server. Nothing was changed."
  exit 1
fi
# ---- HARD GUARD 2: app dir must exist ----
if [ ! -d /opt/5star-dashboard ] || [ ! -f /opt/5star-dashboard/docker-compose.yml ]; then
  echo "!!! ABORT: /opt/5star-dashboard (with docker-compose.yml) not found. Nothing was changed."
  exit 1
fi
cd /opt/5star-dashboard
BRANCH="claude/new-session-iyh4ib"
echo "==================================================================="
echo " Gold deploy starting on $(hostname) at $(date -u)"
echo "==================================================================="

# ---- STEP 1: fresh DB backup (safe, additive) ----
echo "[1/6] Backing up database..."
cp data/app.db "data/app.db.predeploy.$(date +%Y%m%d_%H%M%S)" || { echo "ABORT: DB backup failed"; exit 1; }
ls -la data/app.db* | tail -4

# ---- STEP 2: make git-tracked WITHOUT losing untracked .env/data ----
echo "[2/6] Loading unified code (branch $BRANCH)..."
command -v git >/dev/null || { apt-get update -qq && apt-get install -y git; }
# Trust this directory BEFORE any git op (files are owned by a different uid than root)
git config --global --add safe.directory /opt/5star-dashboard 2>/dev/null || true
git config --global --add safe.directory '*' 2>/dev/null || true
[ -d .git ] || git init -q
git config user.email "info.5starmedia@gmail.com" 2>/dev/null || true
git config user.name  "Viking Essentials"        2>/dev/null || true
git add -A 2>/dev/null || true                    # .gitignore excludes .env, data/, node_modules
git commit -qm "Gold production state before unified deploy" 2>/dev/null || echo "  (snapshot empty/skipped — rollback still available via gold-production branch + DB backups)"
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/info5starmedia-jpg/5star-dashboard-deploy.git
git fetch --depth=1 origin "$BRANCH" || { echo "ABORT: git fetch failed (network?). Nothing deployed."; exit 1; }
git checkout -f -B "$BRANCH" origin/"$BRANCH" || { echo "ABORT: checkout failed. Nothing deployed."; exit 1; }
rm -f middleware.ts                               # ensure stale middleware gone (proxy.ts is used now) — NO git clean

# ---- STEP 3: verify nothing important was lost (abort if so) ----
echo "[3/6] Verifying preservation..."
[ -f .env ]        || { echo "ABORT: .env missing after checkout!"; exit 1; }
[ -f data/app.db ] || { echo "ABORT: data/app.db missing after checkout!"; exit 1; }
[ -f proxy.ts ]    || { echo "ABORT: proxy.ts missing (unexpected branch state)"; exit 1; }
echo "  .env: OK | data/app.db: OK | proxy.ts: OK | middleware.ts: $( [ -f middleware.ts ] && echo STILL-PRESENT || echo removed )"
python3 -c "import sqlite3; d=sqlite3.connect('file:data/app.db?mode=ro',uri=True); print('  inventory items:', d.execute('SELECT COUNT(*) FROM InventoryItem').fetchone()[0], '| totalQty:', d.execute('SELECT COALESCE(SUM(quantity),0) FROM InventoryItem').fetchone()[0])" 2>/dev/null || echo "  (inventory check skipped)"

# ---- STEP 4: build + restart (the one impactful step) ----
echo "[4/6] Building image and restarting container (brief downtime)..."
docker compose up -d --build || { echo "ABORT: docker build/up failed — previous container may still be running. Review output above."; exit 1; }

# ---- STEP 5: wait for startup + migration ----
echo "[5/6] Waiting for app to come up (migration add_inventory_subtitle applies here)..."
sleep 10
docker compose ps
echo "--- recent app logs ---"
docker compose logs --tail=40 app 2>/dev/null | grep -iE 'migration|applying|listening|ready|started|compiled|error' | tail -20 || docker compose logs --tail=20 app

# ---- STEP 6: verify live ----
echo "[6/6] Verifying live app + database shape..."
CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 http://127.0.0.1:3002/api/health 2>/dev/null || echo "000")
echo "  /api/health -> HTTP $CODE"
python3 - <<'PY' 2>/dev/null || echo "  (db shape check skipped)"
import sqlite3
d=sqlite3.connect('file:data/app.db?mode=ro',uri=True)
cols=[r[1] for r in d.execute('PRAGMA table_info(InventoryItem)')]
print("  InventoryItem content col:", 'content' in cols, "| subtitle col:", 'subtitle' in cols)
print("  items:", d.execute('SELECT COUNT(*) FROM InventoryItem').fetchone()[0],
      "| totalQty:", d.execute('SELECT COALESCE(SUM(quantity),0) FROM InventoryItem').fetchone()[0])
PY
echo "==================================================================="
echo " DEPLOY COMPLETE. HTTP 200 + inventory intact = you're live."
echo " Rollback if ever needed:"
echo "   cd /opt/5star-dashboard && git checkout -f gold-production && docker compose up -d --build"
echo "==================================================================="

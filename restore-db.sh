#!/usr/bin/env bash
set -uo pipefail
[ "$(hostname 2>/dev/null)" = "Proxyserver" ] || { echo "ABORT: not the Gold server"; exit 1; }
cd /opt/5star-dashboard 2>/dev/null || { echo "ABORT: app dir missing"; exit 1; }
qty() { python3 -c "import sqlite3,sys; d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True); print(d.execute('SELECT COALESCE(SUM(quantity),0) FROM InventoryItem').fetchone()[0])" "$1" 2>/dev/null || echo 0; }
best=""
for f in $(ls -t data/app.db.predeploy.* data/app.db.backup.* 2>/dev/null); do
  if [ "$(qty "$f")" -gt 0 ]; then best="$f"; break; fi
done
[ -n "$best" ] || { echo "ABORT: no backup with any stock found — nothing to restore"; exit 1; }
echo "Most recent backup WITH stock: $best  ($(qty "$best") units)"
echo "Safety-copying current DB, then restoring..."
cp data/app.db "data/app.db.beforeRestore.$(date +%Y%m%d_%H%M%S)"
docker compose stop app
cp "$best" data/app.db
docker compose up -d
sleep 8
python3 -c "import sqlite3; d=sqlite3.connect('file:data/app.db?mode=ro',uri=True); print('RESTORED -> items:', d.execute('SELECT COUNT(*) FROM InventoryItem').fetchone()[0], '| total units:', d.execute('SELECT COALESCE(SUM(quantity),0) FROM InventoryItem').fetchone()[0])"
echo "Done. Hard-refresh the dashboard (Ctrl+Shift+R)."

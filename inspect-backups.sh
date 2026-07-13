#!/usr/bin/env bash
set -uo pipefail
[ "$(hostname 2>/dev/null)" = "Proxyserver" ] || { echo "ABORT: not the Gold server"; exit 1; }
cd /opt/5star-dashboard/data 2>/dev/null || { echo "ABORT: data dir missing"; exit 1; }
echo "=== inventory contained in each DB file (READ-ONLY) ==="
for f in app.db app.db.predeploy.* app.db.backup.*; do
  [ -f "$f" ] || continue
  info=$(python3 -c "import sqlite3,sys
d=sqlite3.connect('file:'+sys.argv[1]+'?mode=ro',uri=True)
n=d.execute('SELECT COUNT(*) FROM InventoryItem').fetchone()[0]
q=d.execute('SELECT COALESCE(SUM(quantity),0) FROM InventoryItem').fetchone()[0]
print(f'{n} items, {q} total units')" "$f" 2>/dev/null || echo "unreadable")
  printf '  %-40s -> %s\n' "$f" "$info"
done
echo "(the app currently uses app.db)"

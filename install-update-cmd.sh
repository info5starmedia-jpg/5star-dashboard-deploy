#!/usr/bin/env bash
# One-time installer: creates a global `update` command on Gold that pulls the
# latest unified branch and rebuilds via the guarded deploy script.
set -uo pipefail
[ "$(hostname 2>/dev/null)" = "Proxyserver" ] || { echo "ABORT: not the Gold server"; exit 1; }
cat > /usr/local/bin/update <<'EOF'
#!/usr/bin/env bash
# `update` — deploy the latest 5Star/Viking dashboard to this Gold server.
curl -fsSL https://raw.githubusercontent.com/info5starmedia-jpg/5star-dashboard-deploy/claude/new-session-iyh4ib/deploy-gold.sh -o /tmp/deploy-gold.sh && bash /tmp/deploy-gold.sh
EOF
chmod +x /usr/local/bin/update
echo "INSTALLED ✅  — the 'update' command is ready."
echo "From now on, deploy the latest by running:  ssh ... root@134.195.157.229 update"

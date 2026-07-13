# CLAUDE.md — Operations & deploy playbook

Guidance for any future Claude session working on this repo. **This repo is PUBLIC — never commit secrets** (server IPs/ports, SSH keys, `.env`, DB files, credentials).

## What this is
Viking Essentials / 5Star Media admin dashboard — Next.js 16 (Turbopack) + Prisma (SQLite) + NextAuth + Stripe. Features: inventory + content-delivery, invoices, promo-code platform, knowledge base, analytics, user management.

## Production server ("Gold")
- App lives at `/opt/5star-dashboard`, run via `docker compose` (service `app`, published on `127.0.0.1:3002 -> 3000`).
- Server hostname is **`Proxyserver`** (all guarded scripts refuse to run unless the hostname matches).
- Live DB: `data/app.db` (SQLite, bind-mounted from the host). Secrets in `.env`. **Both are `.gitignore`d and are never overwritten by a deploy.**
- On container start, `scripts/start.js` runs `prisma migrate deploy` then `next start`.

## How to deploy (IMPORTANT)
**Claude cannot reach Gold directly** — the egress proxy blocks the server's non‑443 SSH port, so Claude can *never* SSH/deploy itself. The deploy is always run **by the owner** from their machine.

Workflow to ship a change:
1. Commit + push to the working branch **`claude/new-session-iyh4ib`**.
2. Tell the owner to run the one‑word **`update`** command over SSH to Gold. That's it.

The `update` command (installed at `/usr/local/bin/update` on Gold) fetches and runs `deploy-gold.sh`. The owner's SSH connection string (key path, port, host) is held **privately by the owner — intentionally not stored in this public repo**. If a future session needs it, ask the owner (or read it from a private environment variable if one has been configured); do not hard‑code it here.

## Guarded scripts in this repo (all host‑locked to `Proxyserver`, preserve `.env` + `data/`, no `git clean`)
- **`deploy-gold.sh`** — backs up the DB, pulls the branch (`git checkout -f`, not `git clean`), rebuilds the image, migrates, verifies (`/api/health` 200 + inventory counts). This is what `update` runs.
- **`inspect-backups.sh`** — READ‑ONLY; lists how many inventory items/units each `data/app.db*` backup holds.
- **`restore-db.sh`** — stops app, safety‑copies the current DB, restores the most recent backup that has stock, restarts, verifies.
- **`install-update-cmd.sh`** — one‑time installer that creates the `update` command on Gold.

## Data safety & rollback
- Every deploy auto‑creates a timestamped DB backup: `data/app.db.predeploy.*`.
- Rollback code: `cd /opt/5star-dashboard && git checkout -f gold-production && docker compose up -d --build`.
- Branch **`gold-production`** = pristine snapshot of the original (pre‑reconciliation) live code — the rollback reference. Do not delete it.
- Restore data with `restore-db.sh` (owner runs it via SSH).

## Migrations
8 Prisma migrations. Gold's original 7 are kept byte‑for‑byte (checksums match the live `_prisma_migrations`); `20260707212110_add_inventory_subtitle` is stacked last. Keep existing migration files immutable; only add new ones. `InventoryItem` has both `content` (delivery lines) and `subtitle`.

## Gotchas
- **Public repo** → no secrets, ever.
- The owner works in **Windows PowerShell**, where `&&` is not a valid separator. To run server commands, prefer a single remote call: `ssh <owner-conn> "cd /opt/5star-dashboard && …"` (the `&&` then runs in the server's bash, not PowerShell). Always confirm the prompt shows `root@Proxyserver` before running anything meant for the server.
- Freeform inventory categories (Digital Product / Custom) create a **separate** item each, with an auto‑unique SKU derived from the name; pooled categories (server/ISP/etc.) restock a single canonical SKU.
- Checkout takes price from the DB (never the client); the Stripe webhook is signature‑verified, idempotent (releases the claim on failure), and decrements stock atomically. Stripe `apiVersion` is pinned `2023-10-16` (needed by the promo `coupon` param) — don't bump it without checking the promo flow.

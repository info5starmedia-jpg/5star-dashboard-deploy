# 5Star Media Dashboard

**Staging:** https://staging.5starmediaprod.com
**Production:** https://app.5starmediaprod.com

A production Next.js web dashboard for 5Star Media providing admin tooling, subscriber management, Stripe billing, and inventory/invoicing.

---

## Features

| Area | What it does |
|---|---|
| **Auth** | Discord + Google OAuth via NextAuth. JWT sessions. Role-based access (admin / subscriber). |
| **Admin panel** | User management, role promotion/demotion, audit log |
| **Inventory** | CRUD items (SKU, qty, price, cost). Valuation + profit metrics. |
| **Invoices** | Create invoices with line items. Auto-decrements inventory by SKU. PDF generation. Void/cancel. |
| **Billing** | Stripe subscriptions — checkout, billing portal, webhook. Entitlement-gated dashboard. |
| **Audit log** | Every admin action (role change, invoice create/void/cancel) is logged with actor + IP. |

---

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Auth:** NextAuth v4 — Discord + Google providers
- **Database:** Prisma + SQLite (`./data/app.db`)
- **Payments:** Stripe
- **Styling:** Tailwind CSS v4
- **Runtime:** Node 20 in Docker

---

## Quick Start (Local)

```bash
npm install
cp .env.example .env          # fill in your secrets
npx prisma migrate dev
npm run dev                   # http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_SECRET` | ✅ | Random secret for JWT signing |
| `NEXTAUTH_URL` | ✅ | Full URL of the app (e.g. `https://app.5starmediaprod.com`) |
| `DISCORD_CLIENT_ID` | ✅ | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | ✅ | Discord OAuth app client secret |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | ✅ | Stripe secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_MONTHLY` | ✅ | Stripe price ID for the monthly plan |
| `OWNER_EMAIL` | ✅ | Email address that always has admin access |
| `ADMIN_EMAIL_ALLOWLIST` | optional | Comma-separated additional admin emails |
| `DATABASE_URL` | optional | Defaults to `file:./data/app.db` |

---

## Deployment (Docker)

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f app

# Restart
docker compose restart app

# Stop (data is safe — see volume below)
docker compose down
```

The app binds to `127.0.0.1:3002` inside Docker. Put Nginx or Caddy in front for HTTPS.

---

## Volume Persistence

SQLite data is stored outside the container in `./data/`:

```yaml
volumes:
  - ./data:/app/data   # survives docker compose down / up / rebuild
```

**`docker compose down` does NOT delete `./data/`.** Your database is safe.
**`docker compose down -v`** WOULD delete named volumes — but this project uses a bind mount, not a named volume, so even `-v` leaves `./data/` intact.

---

## Data Safety

### Backup

```bash
npm run backup:db
# or inside the container:
docker compose exec app npm run backup:db
```

Creates a timestamped copy at `./data/backups/app_YYYY-MM-DDTHH-MM-SS.db`.

### Export (JSON snapshot)

```bash
npm run export:db
# or:
docker compose exec app npm run export:db
```

Writes `./data/exports/export_YYYY-MM-DDTHH-MM-SS.json` with all table data.

### Restore Procedure

> ⚠️ This replaces the live database. Take a fresh backup first.

**Option A — Replace file directly (recommended for single-server deploys):**

```bash
# 1. Stop the app container
docker compose stop app

# 2. Confirm which backup you want
ls ./data/backups/

# 3. Replace the database
cp ./data/backups/app_2026-03-24T12-00-00.db ./data/app.db

# 4. Start the app (migrations run automatically on startup)
docker compose start app

# 5. Verify
curl http://localhost:3002/api/health
```

**Option B — Restore from JSON export:**

```bash
# 1. Stop the app
docker compose stop app

# 2. Delete the corrupt DB
rm ./data/app.db

# 3. Start fresh (Prisma will create a new empty DB)
docker compose start app

# 4. Import data manually via Prisma Studio or a custom seed script
docker compose exec app npx prisma studio
```

**Automated backups (cron example):**

```bash
# Add to server crontab — backs up every day at 2am
0 2 * * * cd /opt/viking-dashboard/prod && docker compose exec -T app npm run backup:db
```

---

## Admin Routes

| Route | What |
|---|---|
| `/admin` | Admin home |
| `/admin/inventory` | Inventory CRUD + metrics |
| `/admin/invoices` | Invoice management + PDF download |
| `/admin/audit` | Audit log + user role management |

All `/admin/*` and `/api/admin/*` routes require `isAdmin = true` in the JWT. Non-admins are redirected to `/signin`.

---

## Stripe Webhook

Register this URL in your Stripe dashboard:

```
https://app.5starmediaprod.com/api/stripe/webhook
```

Events handled: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

---

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, auth flow, data model
- [VALIDATION.md](VALIDATION.md) — pre-release validation checklist

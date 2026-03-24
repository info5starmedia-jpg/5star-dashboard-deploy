# 5Star Media Dashboard — Architecture

> Last updated: 2026-03-24 (v1.0.0)

---

## Overview

A Next.js (App Router) web dashboard running in Docker. Uses Prisma + SQLite for persistence, NextAuth for authentication, and Stripe for subscription billing.

```
Browser
  │
  ├─ Next.js App Router (SSR + Client Components)
  │    ├─ /app/                 Pages + layouts
  │    ├─ /app/api/             Route handlers (REST-style)
  │    ├─ /components/          Shared UI components
  │    └─ /lib/                 Server utilities
  │
  ├─ NextAuth JWT              Auth session (Discord + Google)
  ├─ Prisma ORM                DB access layer
  ├─ SQLite                    Database (./data/app.db)
  └─ Stripe SDK                Payments
```

---

## Authentication & Authorization

**Provider:** NextAuth v4
**Strategy:** JWT (stateless — no DB session table)

### Sign-in Flow

```
1. User visits /signin
2. Clicks Discord or Google
3. OAuth redirect → NextAuth callback
4. signIn() callback upserts User row + updates lastLoginAt
5. jwt() callback bakes isAdmin + isSubscriber flags into the token
6. session() callback exposes those flags to the client
7. User lands on /dashboard or /admin
```

### JWT Claims

```ts
{
  email: string
  isAdmin: boolean           // true if email is in OWNER_EMAIL or ADMIN_EMAIL_ALLOWLIST
  isSubscriber: boolean      // true if active Stripe subscription exists
  subscriptionStatus: string // "active" | "trialing" | "past_due" | etc.
  currentPeriodEnd: string   // ISO date
}
```

### Admin Check Logic

Admin access is **env-var based**, not DB-role based:

```
isAdmin = email === OWNER_EMAIL  OR  email in ADMIN_EMAIL_ALLOWLIST
```

`OWNER_EMAIL` is read from the environment with a hardcoded fallback of `info.5starmedia@gmail.com`.

### Route Protection Layers

1. **`middleware.ts`** — Edge middleware, runs before every request. Redirects:
   - `/admin/**` → `/signin` if not admin
   - `/api/admin/**` → 401 if not admin
   - `/dashboard/**` → `/billing` if not subscriber (and not admin)
   - `/billing/**` → `/signin` if not authenticated
   - Stripe webhook path `/api/stripe/webhook` is explicitly bypassed

2. **Layout guards** — `app/admin/layout.tsx` calls `requireAdminSession()` server-side as a second check

3. **Route handler guards** — every `/api/admin/*` handler independently verifies the session

---

## Database

**ORM:** Prisma 5.22
**Engine:** SQLite
**File:** `./data/app.db` (bind-mounted into Docker at `/app/data/app.db`)

### Schema (7 models)

| Model | Purpose |
|---|---|
| `User` | Registered users. `email` is unique key. `role` field for DB-level role (currently informational — auth uses env-based check). `lastLoginAt` updated on every sign-in. |
| `AuditLog` | Immutable append-only log. Every admin action writes a row: `actorEmail`, `action`, `targetEmail`, `ip`, `userAgent`. |
| `Subscription` | One row per user. Tracks Stripe `customerId`, `subscriptionId`, `status`, `currentPeriodEnd`. Unique on `stripeSubscriptionId`. |
| `StripeEvent` | Idempotency table. Every incoming Stripe webhook event is inserted here first — duplicate event IDs are silently dropped. |
| `InventoryItem` | Stock items. `sku` is unique. Tracks `quantity`, `priceCents`, `costCents`. |
| `Invoice` | Invoice header. `status` can be `issued`, `void`, or `cancelled`. Only `issued` invoices can be voided/cancelled. |
| `InvoiceLineItem` | Line items for each invoice. Cascade-deleted with parent invoice. |

### Migrations

```bash
# Development
npx prisma migrate dev

# Production (runs automatically on container start)
npx prisma migrate deploy
```

---

## API Routes

### Auth
| Method | Path | Description |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth handler |
| GET | `/api/health` | Returns `{ ok: true, env, time, version }` |

### Stripe
| Method | Path | Description |
|---|---|---|
| POST | `/api/stripe/create-checkout-session` | Creates Stripe Checkout session |
| POST | `/api/stripe/create-portal-session` | Creates Stripe billing portal session |
| POST | `/api/stripe/webhook` | Handles Stripe webhook events (idempotent) |

### Admin (require `isAdmin`)
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/audit` | Last 50 audit log entries |
| GET/PATCH | `/api/admin/users` | List users / change role |
| GET/POST | `/api/admin/inventory` | List / create inventory items |
| DELETE | `/api/admin/inventory/[id]` | Delete inventory item |
| GET/POST | `/api/admin/invoices` | List / create invoices |
| PATCH | `/api/admin/invoices/[id]` | Update invoice status (void / cancel) |
| GET | `/api/admin/invoices/[id]/pdf` | Stream PDF of invoice |
| GET | `/api/admin/metrics/inventory` | Aggregated valuation + profit |

---

## Stripe Billing Flow

```
1. User clicks Subscribe on /billing
2. POST /api/stripe/create-checkout-session
   → creates/finds Stripe Customer
   → creates Checkout Session with metadata: { userEmail }
   → returns {url} for redirect
3. User completes Stripe Checkout
4. Stripe fires checkout.session.completed webhook
   → handler fetches real subscription from Stripe
   → upserts Subscription row with active status
5. Stripe also fires customer.subscription.created
   → handler links stripeSubscriptionId to subscription row
6. On next JWT refresh, getEntitlementsByEmail() sees active subscription
   → isSubscriber = true baked into token
7. /dashboard is now accessible
```

### Webhook Idempotency

Every Stripe event ID is written to `StripeEvent` with a unique constraint.
If the same event arrives twice, the second insert throws → handler returns `{ duplicate: true }` and skips processing.

---

## Invoice Flow

```
Admin creates invoice via /admin/invoices
  ↓
POST /api/admin/invoices
  ↓ (Prisma transaction)
  ├─ Validate all SKUs have sufficient stock
  ├─ Create Invoice row (status: "issued")
  ├─ Create InvoiceLineItem rows
  └─ Decrement InventoryItem.quantity for each SKU
  ↓
Audit log entry written (invoice_create)
  ↓
Admin downloads PDF: GET /api/admin/invoices/[id]/pdf
  ↓ lib/pdf.ts
  Pure-Node PDF 1.4 generator (no native deps)
  Multi-page support (~46 lines per page)
  Streams as application/pdf attachment
```

### Invoice Status Transitions

```
issued → void       (PATCH { status: "void" })
issued → cancelled  (PATCH { status: "cancelled" })
void   → (terminal, no further changes)
cancelled → (terminal, no further changes)
```

---

## PDF Generation

`lib/pdf.ts` generates PDF 1.4 documents in pure Node.js with no external dependencies (no pdfkit, puppeteer, or canvas).

- Constructs raw PDF object stream manually
- Handles multi-page documents by splitting lines into ~46-line pages
- Font: Helvetica (built into all PDF readers, no embed needed)
- No network calls — runs entirely in memory

---

## Deployment

### Docker

```dockerfile
FROM node:20-bookworm-slim
# apt: openssl, ca-certificates, curl
# npm ci
# prisma generate
# npm run build
# CMD: prisma migrate deploy && npm start
```

`scripts/start.js` runs before `next start`. It strips Docker `env_file` quoting artifacts from all env vars (leading/trailing quotes and whitespace) before running migrations.

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:3002:3000"   # not public — put Nginx/Caddy in front
    env_file: .env
    volumes:
      - ./data:/app/data          # SQLite + backups + exports persist here
    restart: unless-stopped
    environment:
      - NEXT_DISABLE_FONT_OPTIMIZATION=1
```

### Volume Persistence

The `./data` bind mount survives all of:
- `docker compose restart`
- `docker compose down && docker compose up`
- Image rebuilds (`docker compose up -d --build`)
- `docker compose down -v` (bind mounts are NOT deleted by `-v`)

---

## Fonts

The app uses the **Tailwind CSS system-font stack** (`font-sans`) — no Google Fonts or external CDN dependency. This ensures Docker builds succeed in network-restricted environments.

---

## Data Safety

| Operation | Command | Output |
|---|---|---|
| Backup DB | `npm run backup:db` | `./data/backups/app_<timestamp>.db` |
| Export JSON | `npm run export:db` | `./data/exports/export_<timestamp>.json` |
| Restore DB | See README.md restore procedure | — |

See [README.md](README.md) for full restore procedure.

---

## Security Model

| Concern | Implementation |
|---|---|
| Session forgery | NextAuth JWT signed with `NEXTAUTH_SECRET` |
| Admin escalation | Admin check is env-var based, not JWT claim forgeable |
| Webhook tampering | `stripe.webhooks.constructEvent()` verifies signature on every request |
| Duplicate webhooks | `StripeEvent` unique constraint provides idempotency |
| CSRF (sign-out) | Uses NextAuth `signOut()` client function, not raw form POST |
| Sensitive fields | Prisma `select` limits what fields are returned in API responses |
| Admin data isolation | Admin API types never returned from user-facing routes |

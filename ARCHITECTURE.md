# 5Star Media Dashboard – Architecture

This document describes the system architecture, data flow, and security model.

---

## 🔐 Authentication & Authorization

**Auth Provider:** NextAuth  
**Session Type:** JWT (stateless)

### Roles
- **Admin**
  - Inventory management
  - Invoice creation + PDFs
  - Metrics & audit logs
- **Subscriber**
  - Dashboard access
  - Billing portal

### Enforcement
- Middleware (`middleware.ts`) protects routes
- Admin-only routes live under:
  - `/admin`
  - `/api/admin/*`
- Unauthorized access redirects with reason banners

---

## 💳 Billing (Stripe)

### Components
- Checkout session API
- Customer portal API
- Webhook handler

### Flow
1. User signs in
2. Subscriber clicks “Subscribe”
3. Stripe Checkout
4. Webhook updates subscription state
5. App gates features based on entitlement

---

## 📦 Inventory & Metrics

### Data
- SKU
- Quantity
- Price (cents)
- Cost (cents)

### Capabilities
- CRUD inventory items
- Inventory valuation + profit metrics via `/api/admin/metrics/inventory`

---

## 🧾 Invoices

### Flow
1. Admin creates invoice
2. Line items stored in DB
3. Inventory decremented (if SKU matches)
4. PDF generated on demand
5. PDF served via admin-only endpoint

---

## 🧠 Database (Prisma + SQLite)

- SQLite database at `./data/app.db`
- Prisma schema is source of truth
- Migrations are committed

---

## 🐳 Deployment

### Docker
- Node 20 base image
- Build-time Prisma generate
- Production Next.js build inside container

### Volumes
```yaml
./data:/app/data
```

---

## 💾 Data Safety

- Backup: `npm run backup:db`
- Export: `npm run export:db`
- Restore: replace `./data/app.db` from a backup

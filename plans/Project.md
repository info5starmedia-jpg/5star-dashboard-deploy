# 5Star Media Dashboard — Project Handoff

This document freezes the current state of the 5Star Media Dashboard so work can safely resume later without re-discovery or confusion.

Repo: 5star-dashboard-deploy  
Primary branch: main  
Active feature work: invoices / metrics / dark mode

---

## 🧭 What This Project IS

A **production web dashboard** for 5Star Media that:

- Uses Next.js (App Router)
- Authenticates users via NextAuth
- Sells subscriptions via Stripe
- Provides **admin-only** inventory, invoicing, and analytics tools
- Runs fully in Docker on a Linux server
- Persists data with Prisma + SQLite

⚠️ This is **NOT** a ticket bot, scraper, or Discord project.

---

## 🚦 Current Reality (Truth Snapshot)

### ✅ Fully Working
- Authentication (Discord + Google OAuth)
- Role-based access control (admin vs subscriber)
- Stripe subscriptions + billing portal
- Admin inventory CRUD (base functionality)
- Dockerized production deployment
- Prisma schema + DB persistence
- Health endpoint (`/api/health`)
- Safe production restarts

### 🟡 Implemented but NOT fully verified
- Invoice creation APIs
- Invoice PDF generation
- Inventory valuation & profit metrics
- Admin audit logging UI
- Admin-only dark mode

Code exists in branches and/or was partially merged.  
Some routes returned 404 previously due to branch drift or missing directories.

### ❌ Not Yet Finalized
- End-to-end invoice flow validation
- Metrics endpoint verification
- Invoice PDF download confirmation
- Database backup/export tooling
- Admin analytics dashboard
- Monitoring/alerts

---

## 🧱 Known Constraints & Gotchas

- `.env` is intentionally NOT committed
- npm registry access may be restricted in some environments
- Stripe env vars must exist or build may fail
- SQLite DB lives at `/app/data/app.db`
- Do NOT assume Codex ran successfully unless files exist on disk

---

## 📍 Canonical Paths (IMPORTANT)

**Server deployment path**
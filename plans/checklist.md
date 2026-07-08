
---

# 📄 FILE 2 — CHECKLIST.md  
**Purpose:**  
> “Exactly what do I do next, in what order, without rethinking the system?”

---

## ✅ `CHECKLIST.md` (copy exactly)

```md
# 5Star Media Dashboard — Completion Checklist

Use this list to safely complete the project after the handoff.

---

## 🔁 Phase 1 — Sanity Check (15 minutes)

- [ ] `cd /opt/viking-dashboard/prod`
- [ ] `git pull origin main`
- [ ] `docker compose ps` (app running)
- [ ] Visit `/api/health` → expect `{ ok: true }`
- [ ] Confirm admin login works
- [ ] Confirm subscriber login works

---

## 🧾 Phase 2 — Invoices (HIGH PRIORITY)

### Files that MUST exist
- [ ] `app/admin/invoices/page.tsx`
- [ ] `app/api/admin/invoices/route.ts`
- [ ] `app/api/admin/invoices/[id]/pdf/route.ts`
- [ ] `lib/pdf.ts`

### Functional checks
- [ ] Admin can open `/admin/invoices`
- [ ] Admin can create invoice
- [ ] Invoice saves to DB
- [ ] Inventory decrements when SKU matches
- [ ] PDF downloads successfully
- [ ] Non-admin is redirected (307)

---

## 📊 Phase 3 — Inventory Metrics

### Files that MUST exist
- [ ] `app/api/admin/metrics/inventory/route.ts`
- [ ] Inventory includes `costCents`

### Functional checks
- [ ] Metrics endpoint returns JSON (not 404)
- [ ] Inventory valuation card renders
- [ ] Profit calculations are correct
- [ ] Non-admin blocked from metrics API

---

## 🌗 Phase 4 — Admin UI Polish

- [ ] Dark mode toggle works
- [ ] Dark mode is admin-scoped
- [ ] Admin navigation includes:
  - Inventory
  - Invoices
  - Audit
- [ ] Audit log page loads

---

## 💾 Phase 5 — Data Safety (IMPORTANT)

- [ ] Add SQLite backup script
- [ ] Add DB export command
- [ ] Document restore procedure
- [ ] Confirm volume persistence

---

## 🚀 Phase 6 — v1.0 Lock

- [ ] All admin routes return 200 or 307 (never 404)
- [ ] Stripe webhooks verified
- [ ] No build-time external fetches
- [ ] README + ARCHITECTURE up to date
- [ ] Tag release: `v1.0.0`

---

## 🧭 Optional Next Features (Post-v1)

- Admin analytics dashboard
- Revenue charts
- User activity logs
- Email invoice delivery
- Multi-admin roles
# Validation Checklist

## Local validation (before production)

1. Install dependencies: `npm install`
2. Run lint: `npm run lint`
3. Start dev server: `npm run dev`
4. Admin routes:
   - `/admin` (admin home)
   - `/admin/inventory`
   - `/admin/invoices`
   - `/admin/audit`
5. Invoice flow:
   - Create invoice (with and without SKU)
   - Verify inventory decrements for SKU items
   - Download PDF from the invoice list
6. Metrics:
   - Verify `/api/admin/metrics/inventory` returns JSON
   - Check valuation/profit values on Inventory page
7. Auth gates:
   - Non-admin users are redirected from admin routes
   - Subscriber gating on `/dashboard`

## Production validation (Docker)

1. `docker compose ps` → confirm container is running
2. Health check: `/api/health` returns `{ ok: true }`
3. Confirm admin login and subscriber login
4. Validate invoices + PDF download
5. Validate inventory metrics
6. Confirm `/app/data` volume persistence

## Release

- Verify README + ARCHITECTURE are up to date
- Tag release: `v1.0.0`

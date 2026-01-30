# 5star-dashboard

Staging: https://staging.5starmediaprod.com
Prod:    https://app.5starmediaprod.com

This repo contains a web dashboard with:
- Admin panel (roles: admin/support)
- Customer panel (subscriptions + deliveries)
- Stripe billing + coupons
- OAuth login (Discord + Google)
- Inventory import (paste lines), auto-decrement on successful sale
- Webhooks: low stock + subscription events

## Data safety (SQLite)

- Database file lives at `./data/app.db` (mounted to `/app/data` in Docker via [docker-compose.yml](docker-compose.yml)).
- Create a backup: `npm run backup:db` (writes to `./data/backups`).
- Export JSON snapshot: `npm run export:db` (writes to `./data/exports`).
- Restore procedure:
  1. Stop the app container.
  2. Replace `./data/app.db` with a backup file from `./data/backups`.
  3. Start the app container.

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [VALIDATION.md](VALIDATION.md)

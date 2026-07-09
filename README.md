# 🎁 DropZone

Scheduled reward-drop (mystery box) engagement platform. A brand runs a **campaign**
of dated **drops**; enrolled users open a **box** during its live window and receive
whatever **reward** is inside. Miss the window and the box locks as **missed**.

All drop/reward state is computed and stored **server-side** — boxes and rewards
cannot be forged from the client. See [`docs/`](docs/) for the full PRD.

```
DropZone/
├── backend/    PHP 8.3 dependency-free REST API (PDO + MySQL) + DropEngine + cron
├── frontend/   Next.js 16 admin panel + customer drop experience
└── docs/       PRD + schema notes
```

## Prerequisites
- PHP 8.3+ with `pdo_mysql`
- MySQL 8 (utf8mb4)
- Node 20+ / npm (for the frontend)

## 1. Backend

```bash
cd backend
cp config/config.example.php config/config.php      # then edit DB creds
# or export DZ_DB_HOST / DZ_DB_NAME / DZ_DB_USER / DZ_DB_PASS

# create the database first, e.g.:
mysql -uroot -e "CREATE DATABASE dropzone CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

php cron/migrate.php     # apply all migrations
php cron/seed.php        # demo admin + campaign + vouchers + users

# run the API
php -S localhost:8080 -t public
```

Demo admin login: **admin@dropzone.test / dropzone123**

Schedule the drop-closing cron (marks elapsed boxes `missed`):
```
*/5 * * * * php /path/DropZone/backend/cron/close_drops.php
```

## 2. Frontend

```bash
cd frontend
cp .env.example .env.local     # points at http://localhost:8080
npm install
npm run dev                    # http://localhost:3000
```

- **Admin panel:** http://localhost:3000/login → Branding · Dashboard · Vouchers · Drop Calendar · Analytics
- **Customer experience:** http://localhost:3000/play → enroll, open boxes, collect rewards

## The DropEngine (integrity core)

`backend/src/DropEngine.php` owns all box/reward state:
- **Period mapping** — daily/weekly/monthly drops map to integer period indexes in the campaign timezone.
- **Open validation** — enrolled + active campaign + inside `[open_at, close_at]` + not already opened.
- **Exactly-once issuance** — idempotent per box (`Idempotency-Key` supported); stock decremented atomically; unique-code pool drawn under `FOR UPDATE`.
- **Miss/close** — `close_drops.php` marks elapsed unopened boxes `missed`.
- **Completion** — enrollment marked complete once every box is terminal.
- **Audit** — every transition written to `box_events`.

## 3. Deploying to cPanel (no Node.js required)

The backend is dependency-free PHP (no Composer, no build step) and the frontend
is a fully client-rendered Next.js app (no server actions/middleware/route
handlers), so both run on plain cPanel hosting — frontend as static files,
backend as plain PHP under Apache. This layout assumes the frontend and API
share one domain, with the API mounted at `/api`:

```
public_html/
├── index.html, _next/, login/, play/, ...   ← frontend/out/*  (static export)
├── api/            ← backend/public/*        (index.php + .htaccess — web-facing)
├── src/            ← backend/src/*           (blocked from direct HTTP access)
├── config/         ← backend/config/*        (config.php + DB creds — blocked)
├── migrations/     ← backend/migrations/*    (blocked; one-time use)
└── cron/           ← backend/cron/*          (blocked; invoked via CLI/cron only)
```

`backend/public/index.php` locates its dependencies via `__DIR__ . '/../src'` etc.,
so `src/`, `config/`, `migrations/`, `cron/`, and `public/` must stay siblings —
i.e. upload the entire `backend/` folder's contents into `public_html/` and treat
`public/` as `api/`. The non-`api` folders each ship a `.htaccess` that denies all
direct HTTP requests (defense in depth — PHP always executes `.php` files rather
than serving their source, but the deny rule blocks the folder outright).

**Backend:**
```bash
# on the server, inside public_html/config/
cp config.example.php config.php   # edit DB creds
php ../cron/migrate.php            # apply migrations (once)
php ../cron/seed.php               # demo data (optional)
```
Then schedule `php /home/USER/public_html/cron/close_drops.php` every 5 minutes
via cPanel's Cron Jobs UI.

**Frontend:**
```bash
cd frontend
npm run build:cpanel   # next build with output:'export', API base left relative ("/api")
```
Upload the contents of `frontend/out/` to `public_html/`. The build already embeds
relative `/api/...` calls (see `frontend/lib/api.ts`), so no domain needs to be
hardcoded — it works on whatever domain serves it, as long as the PHP API is
reachable at `/api` on that same domain. Local dev is unaffected: `frontend/.env.local`
still points `npm run dev` at `http://localhost:8080`.

If you instead host the API on a separate subdomain, set
`NEXT_PUBLIC_API_BASE=https://api.yourdomain.com npm run build` and point
`cors_origins` in `config.php` at the frontend's origin.

## API surface

Public: `GET /api/health`, `GET /api/campaigns/active`, `POST /api/enroll`,
`GET /api/me/calendar`, `POST /api/boxes/:dropId/open`, `GET /api/me/rewards`,
`POST /api/rewards/:id/redeem`, `GET|POST /api/whatsapp/webhook`.

Admin (`Bearer` token): `/api/admin/{login,logout,brand,vouchers,campaigns,drops,
users,reward-issues,stats,analytics,activity,whatsapp/*}`.

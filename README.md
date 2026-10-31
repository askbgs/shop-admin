# Shop Admin – order dashboard

Next.js 15 admin app for the WhatsApp clothing shop. It reads and updates the same Railway Postgres
database the n8n sales agent writes orders into (`fashion_shop_schema.sql`).

## Features

- **Dashboard** – today's revenue, this month, 30-day average order, pending count, low-stock count,
  daily revenue chart (30 days), orders by status, top products, recent orders.
- **Orders** – status tabs, search by order no / phone / name, date range, pagination.
- **Order detail** – items, totals, customer (WhatsApp link), delivery and payment, and status buttons:
  `pending → confirmed → packed → shipped → delivered`. Cancelling is allowed until shipped and
  **restores stock automatically** (DB trigger `orders_on_cancel`). Updates only apply if the order is
  still in the expected status, so two admins can't overwrite each other.
- **Low stock** – every active variant at or below `LOW_STOCK_THRESHOLD` (default 5), out-of-stock first.
- Password login (signed, http-only cookie, 12 h session). Mobile friendly.

All money values are stored in cents and shown as LKR; dates use Asia/Colombo.

## Deploy on Railway (same project as the Postgres DB)

1. Push this folder to a GitHub repo (or run `railway up` from inside it with the Railway CLI).
2. In the Railway project that has your Postgres → **New → GitHub Repo** → pick the repo.
3. In the new service → **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable – uses the private `postgres.railway.internal` network) |
   | `ADMIN_PASSWORD` | a strong password |
   | `SESSION_SECRET` | 32+ random characters (`openssl rand -hex 32`) |
   | `LOW_STOCK_THRESHOLD` | `5` (optional) |

   Leave `DATABASE_SSL` unset on Railway (the private network doesn't use SSL).
4. Railway detects Next.js and runs `npm run build` / `npm start` automatically.
5. **Settings → Networking → Generate Domain** to get the admin URL.

Tip: keep the app and the database in the same region (e.g. `asia-southeast1`) for fast pages.

## Run locally

```bash
cp .env.example .env.local   # use the PUBLIC proxy URL from Railway and DATABASE_SSL=true
npm install
npm run dev                  # http://localhost:3000
```

## Project layout

```
app/login/            login page + login/logout server actions
app/(admin)/page.tsx  dashboard
app/(admin)/orders/   order list, detail page, status-change server action
app/(admin)/stock/    low-stock list
lib/db.ts             pg connection pool
lib/queries.ts        all SQL (parameterised)
lib/session.ts        signed session cookie (Web Crypto, works in middleware)
middleware.ts         protects every page except /login
```

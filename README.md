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
- **Products** – search / category / status filters; create and edit (price in LKR, image URL with preview,
  tags, active flag); sizes, colours, extra price and stock edited inline per variant. Sold products and
  variants can only be deactivated, never deleted, so order history stays intact.
- **Photos** – upload a main photo per product and a separate photo for each variant (colour/size). Photos are
  resized in the browser to max 1600 px JPEG and uploaded to **PinPicX** (`POST /v1/upload`, key in the
  `X-API-Key` header); the PinPicX direct link (`data.url`) is saved as the image URL and the PinPicX image id
  is kept in `hosted_images` so replaced/removed photos are also deleted on PinPicX. Without
  `PINPICX_API_KEY` photos are stored in Postgres (`media` table) and served at `/media/<id>.jpg` instead. Variants without their own photo use the main photo
  (the `variant_catalog` view does `COALESCE(variant image, product image)`). Replaced or removed photos are
  deleted automatically.
- **Categories** – add, rename (moves all products to the new name in one transaction), delete when unused.
- **Customers** – search by name / phone / city, filter by district, sort by spend or orders; lifetime stats
  and order history; edit details (phone numbers are normalised to the `94XXXXXXXXX` WhatsApp format, and
  changing a number moves that customer's orders with it); delete customers who have no orders.
- **Store settings** – store name, tagline, about, logo, contact number, WhatsApp, email, website, social
  links, address, district, opening hours, **delivery fee and free-delivery threshold** (used by the order
  pricing trigger), delivery info, return policy and **bank details** with payment instructions. The n8n
  agent reads these through its `get_store_info` tool.
- Password login (signed, http-only cookie, 12 h session). Mobile friendly.

## Database upgrades

On first start the app runs `lib/migrations.ts` (same SQL in `db/migrations.sql`). It is idempotent and
safe to re-run: it creates `store_settings` and `categories` if missing, adds unique indexes on customer
phone and variant size+colour (skipped with a notice if duplicates exist), adds performance indexes, and
installs the order triggers (pricing reads the delivery fee from `store_settings`, stock is deducted on
order and restored on cancel).

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
   | `PINPICX_API_KEY` | your PinPicX API key – photos are uploaded to pinpicx.app |
   | `PINPICX_ALBUM_ID` | optional – PinPicX album to put the photos in |
   | `PUBLIC_BASE_URL` | optional – only used when no PinPicX key is set (photos served by the dashboard) |

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
app/(admin)/products/ product list, new, edit + variants, server actions
app/(admin)/categories/ category management
app/(admin)/customers/  customer list, new, edit + order history
app/(admin)/settings/ store settings form
lib/db.ts             pg connection pool
lib/migrations.ts     idempotent schema upgrade run on start (lib/migrate.ts)
lib/queries.ts        dashboard + order SQL (parameterised)
lib/catalog.ts        product / category SQL
lib/customers.ts      customer SQL
lib/session.ts        signed session cookie (Web Crypto, works in middleware)
middleware.ts         protects every page except /login
```

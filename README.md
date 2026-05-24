# Allo Inventory — Take-Home Exercise

A Next.js inventory and order-fulfillment platform with race-condition-safe reservation system for multi-warehouse retail.

## Live URL
https://allo-inventory-pied.vercel.app

## Tech Stack
- **Next.js 16** (App Router, TypeScript)
- **Prisma + Supabase** (hosted PostgreSQL)
- **Upstash Redis** (distributed locking)
- **Zod** (request validation)
- **Tailwind CSS + shadcn/ui** (styling)
- **Vercel** (hosting + cron jobs)

## How to Run Locally

### 1. Clone the repo
```bash
git clone https://github.com/sanju530/allo-inventory.git
cd allo-inventory
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
Create a `.env.local` file in the root:
```env
DATABASE_URL="your-supabase-pooled-url"
DIRECT_URL="your-supabase-direct-url"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-project-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
UPSTASH_REDIS_REST_URL="your-upstash-url"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
CRON_SECRET="your-cron-secret"
```

### 4. Run database migrations
```bash
npx prisma db push
```

### 5. Seed the database
```bash
npx prisma db seed
```

### 6. Start the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How the Reservation System Works

### Race Condition Prevention (Core Feature)
Two layers of protection ensure exactly one reservation succeeds when multiple requests come in simultaneously for the last unit:

1. **Redis distributed lock** — When a reservation request comes in, we set a Redis key `lock:stock:{productId}:{warehouseId}` with `NX` (only set if not exists). If another request is already processing the same stock, it gets a 409 immediately without touching the database.

2. **Prisma transaction** — Inside the lock, we use a database transaction to atomically check available stock and increment the reserved count. This ensures consistency even if the Redis lock somehow fails.

### Reservation Lifecycle
```
PENDING → CONFIRMED (payment succeeded, stock permanently decremented)
PENDING → RELEASED (cancelled by user or expired)
```

Stock tracking uses two fields:
- `total` — physical units in warehouse
- `reserved` — temporarily held units
- `available = total - reserved` — what customers can actually buy

## How Expiry Works in Production

Reservations expire after **10 minutes** if not confirmed.

A **Vercel Cron Job** runs every minute hitting `GET /api/cron/expire`. It finds all PENDING reservations where `expiresAt < now()`, releases the stock back (decrements `reserved`), and marks them as RELEASED.

The cron endpoint is protected with a `CRON_SECRET` bearer token so only Vercel can trigger it.

## Idempotency (Bonus)

The `POST /api/reservations` endpoint supports an `Idempotency-Key` header. If a client retries with the same key, the server returns the original reservation without creating a duplicate. The key is stored as a unique field on the Reservation model and checked before processing.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products with available stock per warehouse |
| GET | `/api/warehouses` | List all warehouses |
| POST | `/api/reservations` | Create a reservation (409 if insufficient stock) |
| POST | `/api/reservations/:id/confirm` | Confirm reservation (410 if expired) |
| POST | `/api/reservations/:id/release` | Release reservation early |
| GET | `/api/cron/expire` | Release expired reservations (cron only) |

## Trade-offs and Things I'd Do Differently

**Trade-offs made:**
- Used Redis lock + Prisma transaction instead of pure `SELECT FOR UPDATE` SQL. This gives an extra layer of safety but adds a Redis dependency. For a simpler stack, `SELECT FOR UPDATE` inside a transaction alone would suffice.
- Lazy cleanup on the confirm endpoint (checks expiry when confirming) in addition to the cron job, so expired reservations are caught even if cron is delayed.
- Reserved quantity is always 1 unit per reservation for simplicity. The schema supports any quantity.

**With more time I would:**
- Add user authentication so reservations are tied to accounts
- Add a proper payment flow simulation instead of a simple confirm button
- Add optimistic UI updates and better loading states
- Add email notifications when reservation is about to expire
- Write unit and integration tests for the concurrency logic
- Add an admin dashboard to monitor reservations and stock levels
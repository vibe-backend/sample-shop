# Sample Shop frontend

A mock-data storefront for the vibe-backend sample shop, built with Vite, React 18, TypeScript, Tailwind CSS v4 and [shadcn/ui](https://ui.shadcn.com/). Generated shadcn components live in `src/components/ui/` (add more with `npx shadcn@latest add <name>`); the theme is CSS variables in `src/index.css`, and dark mode uses the `dark` class on `<html>`. The UI is in Traditional Chinese (zh-Hant). It runs entirely on mock data until the backend exists.

Live demo (mock mode, after merge): <https://vibe-backend.github.io/sample-shop/>

## Run locally

```sh
cd frontend
npm ci
npm run dev        # http://localhost:5173, mock mode by default
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run lint` | ESLint plus a TypeScript typecheck |
| `npm run typecheck` | TypeScript only |
| `npm test` | Vitest unit tests (mock adapter and cart math) |
| `npm run build` | Production build into `dist/` (base path `/sample-shop/`); requires `VITE_API_MODE` |
| `npm run preview` | Serve the production build |

## Mock vs real API

The whole app talks to one typed `ShopApi` interface (`src/api/types.ts`), which mirrors the API contract. `src/api/index.ts` picks the adapter at build time:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` in dev; **required** for builds | `mock` uses the in-browser adapter; `real` uses fetch |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend origin, used only when `real` |
| `VITE_SHOP_SLUG` | `main` | The `{slug}` shop constant in catalog paths |
| `VITE_BASE` | `/sample-shop/` | Base path for `npm run build` (dev always uses `/`) |

`npm run build` fails unless `VITE_API_MODE` is set to `mock` or `real`, so a production deploy can't silently ship mock mode with its demo accounts:

```sh
VITE_API_MODE=real VITE_API_BASE_URL=https://your-backend.example npm run build
VITE_API_MODE=mock npm run build   # demo build, as used by the GitHub Pages workflow
```

To switch the dev server to the real backend, copy `.env.example` to `.env.local` and set:

```sh
VITE_API_MODE=real
VITE_API_BASE_URL=https://your-backend.example
```

The real adapter (`src/api/real.ts`) is written against the contract but has not been run against a backend yet.

**Product SKUs / variants (#17): real mode 未支援 SKU (not verified).** `backend/CONTRACT.md` on `backend/markdown-v1` @a3d4304 (§9–§11) now defines `options`, `variants` and `sku_id`, and the real adapter follows it, but the backend does not compile yet, so SKUs have only been exercised in mock mode. Staff SKU management is tracked in #61.

Order creation always sends an `Idempotency-Key` (required, §10 @a3d4304); on `503 TX_CONFLICT` or a network error the real adapter retries up to twice with the same key after `Retry-After`.

**Delivery addresses (#29): real mode defined but unverified.** `GET/POST /shop/v1/addresses` and the required `address_id` on order creation follow `backend/CONTRACT.md` §12 @a3d4304; the backend does not compile yet, so this has only been exercised in mock mode.

**Mock payment (#30): real mode defined in contract, unverified.** `POST /shop/v1/orders/{id}/payments` (`Idempotency-Key` required; `402 PAYMENT_DECLINED`, `409 ORDER_NOT_PAYABLE` / `IDEMPOTENCY_KEY_REUSED`) and `Order.payment_method` / `paid_at` follow `backend/CONTRACT.md` §13 @a3d4304, but the backend does not compile yet, so payment has only been exercised in mock mode. The pay page reuses one key per attempt (new key after a definitive failure or a method change). Stock reservation before payment and auto-cancel of unpaid orders are deferred to #66.

**Order status flow (#34): real mode 未支援 (not in contract yet).** The mock implements `pending → paid → shipped → delivered` plus buyer/staff cancel of `pending`/`paid` orders (stock restored), with `status_history` and `409 INVALID_TRANSITION` for illegal moves. The real adapter calls the *proposed* `POST /shop/v1/orders/{id}/cancel`, `POST /shop/v1/orders/{id}/confirm-delivery`, `GET /shop/v1/staff/orders` and `PUT /shop/v1/staff/orders/{id}/status`, which `backend/CONTRACT.md` @a3d4304 does not define yet.

Mock data is stored in `localStorage` under `shop.mock.v2`. Data from the older `shop.mock.v1` key is migrated once on load (users, orders and staff edits kept; demo SKUs attached; cart lines for products that now need a spec are dropped) and the old key is removed. Migrated users get no demo addresses (only a fresh seed has them), so they add one at checkout.

### Mock mode

- Seed data lives in `src/api/seed.ts`: 13 products, one of them inactive. Product images are generated placeholder SVGs.
- Demo data (users, carts, orders, stock) is saved in `localStorage`. Use **重設示範資料** in the banner to reset it. Sessions are not saved, so a reload signs you out, the same as in real mode.
- Each call waits 150–450 ms to imitate network latency.
- Errors use the contract shape `{code, message}`, for example `401 INVALID_CREDENTIALS`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `409 OUT_OF_STOCK`, `409 EMAIL_TAKEN`, `422 CART_EMPTY`.

### Demo accounts (mock mode only)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `demo@example.com` | `demo1234` |
| Staff (`roles: ["staff"]`) | `staff@example.com` | `staff1234` |

You can also register a new account; it is stored only in your browser.

## Access token handling

In both modes the access token is kept **in memory only** (`src/api/token.ts`). It is never written to `localStorage` or `sessionStorage`, so injected script cannot read it from storage. After a reload the user signs in again. On startup the app also deletes any `shop.token` that an earlier build left in `localStorage`.

For production, pair this with a refresh token in an `httpOnly; Secure; SameSite` cookie and a refresh endpoint, so a reload can quietly get a new access token. The contract doesn't define a refresh endpoint yet, so this frontend doesn't implement that step.

## Pages

Routes use hash routing (`#/...`), so deep links work on GitHub Pages without a server fallback.

| Route | Page |
| --- | --- |
| `#/` | Product list: search, category, price range, sort, cursor paging ("載入更多") |
| `#/products/:id` | Product detail, add to cart |
| `#/cart` | Cart: change quantity, remove, subtotal |
| `#/checkout` | Checkout; places the order with an `Idempotency-Key` |
| `#/orders`, `#/orders/:id` | Order history and detail (the confirmation shows after checkout) |
| `#/login`, `#/register` | Mock auth |
| `#/staff/products`, `/new`, `/:id` | Staff product management, including inactive products |

## Contract assumptions

`backend/CONTRACT.md` did not exist yet, so the client follows the agreed contract summary. Where the summary was silent, these assumptions apply:

- Order `status` values: `pending`, `paid`, `shipped`, `delivered`, `cancelled`.
- Sort is sent as `sort=price|created_at&order=asc|desc`.
- Every cart mutation (POST, PATCH, DELETE) returns the full cart.
- Login/register return `{access_token, expires_at}`; there is no refresh token.
- Product has a `category` string; products and orders carry a `currency` (mock uses HKD).
- Checkout has no address or payment fields.

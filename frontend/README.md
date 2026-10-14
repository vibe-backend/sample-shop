# Sample Shop frontend

A mock-data storefront for the vibe-backend sample shop, built with Vite, React 18 and TypeScript. The UI is in Traditional Chinese (zh-Hant). It runs entirely on mock data until the backend exists.

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
| `npm run build` | Production build into `dist/` (base path `/sample-shop/`) |
| `npm run preview` | Serve the production build |

## Mock vs real API

The whole app talks to one typed `ShopApi` interface (`src/api/types.ts`), which mirrors the API contract. `src/api/index.ts` picks the adapter at build time:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` | `mock` uses the in-browser adapter; `real` uses fetch |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend origin, used only when `real` |
| `VITE_SHOP_SLUG` | `main` | The `{slug}` shop constant in catalog paths |
| `VITE_BASE` | `/sample-shop/` | Base path for `npm run build` (dev always uses `/`) |

To switch to the real backend, copy `.env.example` to `.env.local` and set:

```sh
VITE_API_MODE=real
VITE_API_BASE_URL=https://your-backend.example
```

The real adapter (`src/api/real.ts`) is written against the contract but has not been run against a backend yet.

### Mock mode

- Seed data lives in `src/api/seed.ts`: 13 products, one of them inactive. Product images are generated placeholder SVGs.
- State (users, carts, orders, stock) is saved in `localStorage`. Use **重設示範資料** in the banner to reset it.
- Each call waits 150–450 ms to imitate network latency.
- Errors use the contract shape `{code, message}`, for example `401 INVALID_CREDENTIALS`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `409 OUT_OF_STOCK`, `409 EMAIL_TAKEN`, `422 CART_EMPTY`.

### Demo accounts (mock mode only)

| Role | Email | Password |
| --- | --- | --- |
| Customer | `demo@example.com` | `demo1234` |
| Staff (`roles: ["staff"]`) | `staff@example.com` | `staff1234` |

You can also register a new account; it is stored only in your browser.

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

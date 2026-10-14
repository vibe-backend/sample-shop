# Frontend shopping draft

This draft builds on the address, payment and order-status PR stack (#64 → #65 → #68 → #69).
It implements the outstanding buyer features in mock mode so the frontend can be reviewed before backend work.
It does not close the issues or change the existing backend source.

## Issue coverage

| Issues | Draft behavior | Remaining work |
| --- | --- | --- |
| #7–#10 | Linked rotating banners; category icons; active-product recommendations; ten recent products | Banners use generated artwork; recommendation algorithm is a demo |
| #11–#15 | Sales/rating/relevance sorting; keyboard search suggestions and history; simulated image search; nested category/brand/attribute filters in URLs; direct category routes and 404 | Real search endpoints and image recognition are not implemented |
| #16, #18 | Multi-image gallery with keyboard/swipe and fallback art; isolated buy-now checkout that preserves the cart, including login return | Backend support for buy-now input |
| #19–#24 | Owned delivered-item reviews with paging/image filters; buyer questions and staff replies; sales counts; shop details/following; delivery policy; share/copy | Backend review, question and shop APIs |
| #25–#28 | Selected-cart checkout; guest cart merging by SKU; stock/price-change warnings; invalid-item cleanup and move to favorites | Current storefront has one shop; multiple-shop grouping needs a shop model |
| #29, #30, #34, #44 | Uses the existing address/payment/status stack; adds valid HK numbers starting with 852; removes ineffective edit-default checkbox | Production integration still depends on backend PR #62 and SDK compilation |
| #31–#33 | Courier/pickup; free delivery threshold; coupon/code and points selection; 200-character buyer note; integer-cent totals | Backend quote/create-order extensions; policy confirmation |
| #35–#40 | Status tabs with counts and cursor paging; cancellation reason; simulated shipment timeline/copy; receipt confirmation; review entry; reorder with skipped items; buyer-only order hiding | Backend buyer status filters, shipment and hiding APIs |
| #41–#43 | Mock reset codes with common account-existence message, expiry and attempt limit; account dashboard/counts; name and password changes | Real email delivery and password reset contract |
| #45–#46 | Favorites retain unavailable markers; store following; 30-day browsing history grouped by date with item/all deletion | Saved browsing history is per browser; favorites/following need backend APIs |
| #47–#49 | Per-user single-claim coupons with used/expired views; compare-at prices; automatic spend promotion; limited campaign with countdown and expiry | Campaigns and coupons are demo policies; server validation required |
| #50 | Salted PBKDF2 verifiers; v1/v2 plaintext migration before persistence; no passwords or sessions saved | Mock storage remains a demo, not a production authentication system |
| #51 | Points ledger; award once on completed orders; capped redemption; reversal on cancellation/refund | Production ledger and refund rules |
| #52–#54 | Persisted mock customer-service chat; searchable FAQ by topic; footer and order-number mailto contact | Contact email is `support@example.com` (placeholder); no real seller inbox or chat transport |
| #55–#58 | Per-item refund/return applications with reason and up to three images; staff decisions; buyer progress; refund amount; seven-day policy; return shipment after approval | Production refunds, return inventory accounting and object storage |
| #61 | Staff SKU list/create/edit/enable/disable, schema and duplicate checks, optimistic version check, preserved order snapshots | HTTP If-Match SKU contract, server implementation and multi-client concurrency |
| #66 | Available stock reserves at placement; 30-minute expiry; release on cancel/expiry; commit on payment; exclusive state transitions | Mock sweep runs on API activity and order-page polling. An external server scheduler must expire reservations while the browser is closed |

## Demo policies

- HKD integer cents throughout; courier HK$30, free when merchandise subtotal reaches HK$300; pickup free.
- HK$20 spend discount at HK$500; can combine with one claimed coupon.
- Points: completed net merchandise HK$1 earns one point; one point redeems HK$1, capped at 10% of merchandise after promotion/coupon.
- Coupons: each account can claim each seeded coupon once. An order consumes the coupon at creation, including unpaid/cancelled orders.
- Pending orders reserve available stock for 30 minutes. Product stock represents available quantity; reserved_stock tracks held units. Payment commits the held quantity without a second decrement.
- Returns allocate discounts across line items; refund totals cannot exceed paid merchandise. Shipping refunds are outside this draft.
- No-reason return window starts at confirmed delivery. Other product-quality claims can still be submitted after that window.
- SKU option edits that invalidate an active variant are rejected. Disable or update the variant first. SKU combinations are unique even when inactive; re-enable rather than duplicate.

## API boundary

The existing deployed-contract fetch methods are retained. New ShopFeatures methods in real mode return 501 FEATURE_NOT_AVAILABLE instead of calling invented endpoints.
Buy-now and partial checkout are explicitly refused in real mode so they cannot accidentally order the entire cart.
The expanded types in src/api/features.ts and src/api/types.ts describe the proposed frontend contract, not a verified backend.
Backend PR #62 remains a separate draft; its CONTRACT.md sections 4b/13 need a coordinated revision before production reservations.

## Validation

Run from frontend:

```sh
npm ci
npm run lint
npm test
VITE_API_MODE=mock npm run build
VITE_API_MODE=real npm run build
```

API tests cover guest merge, buy-now isolation, selected checkout, totals, coupon reuse/expiry, reservation/pay/cancel races, credential migration, review ownership, return transitions and SKU optimistic versions.
UI tests cover buy-now and selected checkout through order placement, gallery switching, category routing and the inherited address/payment/status screens.

## Follow-up acceptance audit

The draft now includes explicit previous/next banner controls, arrow-key search selection while focus stays in the search input, category-route filter clearing, and independent product review state when navigating between products.
Cart initialization waits for authentication so the selected lines cannot reset during login bootstrap.
Rejected cancellation preserves the existing order reason. Delivery points exclude prior refunds, and successive item refunds reverse the full remaining points balance without losing rounding.
Staff SKU versions advance when checkout reserves or commits stock; stale inventory edits fail instead of restoring already-reserved availability.
The real product editor reads inactive products from the staff endpoint and sends the exact response ETag in If-Match. Dedicated SKU routes are now wired to the backend follow-up contract. These HTTP routes still require a compiled backend.

Validation: 136 frontend tests, ESLint/TypeScript, mock and real production builds. Backend follow-up adds PostgreSQL migrations and eight SQL/concurrency tests; SDK HTTP/RLS and deployed scheduling remain pending.
The frontend draft addresses the demo acceptance criteria for #7–#58 (excluding the previously completed #17). Backend-specific #61/#66 stay open for compiled and deployed verification.

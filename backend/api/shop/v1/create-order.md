---
writes: true
---

The signed-in caller uses this route.
Path: POST `/shop/v1/orders`
This creates a row.

The body supplies an address id and either cart line ids or a buy-now item. Idempotency-Key is required.

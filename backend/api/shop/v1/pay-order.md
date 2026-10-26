---
writes: true
---

The signed-in caller uses this route.
Path: POST `/shop/v1/orders/{id}/payments`
This updates a row.

The body supplies a payment method and a simulate flag. Idempotency-Key is required. Success sets the order status to paid.

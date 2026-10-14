# 建立訂單

POST `/shop/v1/orders`。需要 JWT。

- header：Idempotency-Key（必填，1 至 64 字）；缺少回 400 IDEMPOTENCY_KEY_REQUIRED。body 為空物件。
- 呼叫 order.place，將 header 的 Idempotency-Key 作為 idempotency_key 傳入。
- 成功回 201 與訂單（id、status、items、total_cents、currency、created_at），並帶 Location。
- 同一使用者以同一 key 與相同 body 重送時，回傳原訂單（201）；同一 key 但 body 不同回 409 IDEMPOTENCY_KEY_REUSED。
- PRODUCT_UNAVAILABLE 的錯誤細節附上受影響的購物車品項 id（details.cart_item_ids）。
- 錯誤：IDEMPOTENCY_KEY_REQUIRED 回 400；IDEMPOTENCY_KEY_REUSED 回 409；CART_EMPTY 回 422；PRODUCT_UNAVAILABLE 回 409；OUT_OF_STOCK 回 409；TX_TIMEOUT 回 504；TX_CONFLICT 回 503（帶 Retry-After: 1）。

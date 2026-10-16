# 建立訂單

POST `/shop/v1/orders`。需要 JWT。

- header：Idempotency-Key（必填，1 至 64 字）；缺少回 400 IDEMPOTENCY_KEY_REQUIRED。body：address_id（uuid，必填）。
- 呼叫 order.place，將 header 的 Idempotency-Key 作為 idempotency_key 傳入，並傳入 address_id；request_hash 依含 address_id 的 body 計算，且必須與訂單同一筆 INSERT 寫入。`(user_id, idempotency_key)` 唯一（CONTRACT §10）。
- 成功回 201 與訂單（id、status、shipping_address、items、total_cents、currency、created_at），並帶 Location。
- 同一使用者以同一 key 與相同 body 重送時，回傳原訂單（201）；同一 key 但 body 不同（包括 address_id 不同）回 409 IDEMPOTENCY_KEY_REUSED。
- PRODUCT_UNAVAILABLE 的錯誤細節附上受影響的購物車品項 id（details.cart_item_ids）。
- 錯誤：IDEMPOTENCY_KEY_REQUIRED 回 400；ADDRESS_REQUIRED 回 422；ADDRESS_NOT_FOUND 回 404（不存在或屬於他人）；IDEMPOTENCY_KEY_REUSED 回 409；CART_EMPTY 回 422；PRODUCT_UNAVAILABLE 回 409；OUT_OF_STOCK 回 409；TX_TIMEOUT 回 504；TX_CONFLICT 回 503（帶 Retry-After: 1）。

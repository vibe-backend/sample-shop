# 建立訂單

POST `/shop/v1/orders`。需要 JWT。

- header：Idempotency-Key（選填，最長 64 字）。body 為空物件。
- 呼叫 order.place，將 header 的 Idempotency-Key 作為 idempotency_key 傳入。
- 成功回 201 與訂單（id、status、items、total_cents、currency、created_at），並帶 Location。
- 錯誤：CART_EMPTY 回 422；PRODUCT_UNAVAILABLE 回 409；OUT_OF_STOCK 回 409。

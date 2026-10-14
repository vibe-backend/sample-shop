# 訂單付款（模擬）

POST `/shop/v1/orders/{id}/payments`。需要 JWT，只限本人的訂單。

- 路徑 id 為 uuid。
- header：Idempotency-Key（必填，1 至 64 字）；缺少回 400 IDEMPOTENCY_KEY_REQUIRED。
- body：method（mock_card 或 mock_alipay，必填）、simulate（success 或 failure，必填）。
- 呼叫 order.pay，會寫入（write）訂單付款狀態；傳入 header 的 Idempotency-Key 與 body 雜湊。
- 成功回 200 與整張訂單（status 為 paid，含 payment_method 與 paid_at）。以同一 key 與相同 body 重送成功的付款，回傳同一張訂單（200）。
- 錯誤：IDEMPOTENCY_KEY_REQUIRED 回 400；PAYMENT_DECLINED 回 402（訂單維持 pending，可用同一 key 重試）；NOT_FOUND 回 404（不存在或屬於他人）；ORDER_NOT_PAYABLE 回 409（已付款或已取消）；IDEMPOTENCY_KEY_REUSED 回 409；驗證不通過回 422 VALIDATION_FAILED；TX_TIMEOUT 回 504；TX_CONFLICT 回 503（帶 Retry-After: 1）。

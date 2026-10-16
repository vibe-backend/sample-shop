# 確認收貨（買家）

POST `/shop/v1/orders/{id}/confirm-delivery`。需要 JWT，只限本人的訂單。

- 路徑 id 為 uuid；body 為空物件 `{}`（有任何欄位回 422）。
- 不需要 Idempotency-Key（重複確認回 409 INVALID_TRANSITION）。
- 呼叫 order.confirm-delivery，會寫入（write）訂單狀態。
- 成功回 200 與整張訂單（status 為 delivered）。
- 錯誤：NOT_FOUND 回 404（不存在或不屬於本人）；INVALID_TRANSITION 回 409（狀態不是 shipped）；TX_TIMEOUT 回 504；TX_CONFLICT 回 503。

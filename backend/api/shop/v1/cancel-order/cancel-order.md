# 取消訂單（買家）

POST `/shop/v1/orders/{id}/cancel`。需要 JWT，只限本人的訂單。

- 路徑 id 為 uuid；body 可含 reason（1–200 字，預設買家取消）；其他欄位回 422。
- 不需要 Idempotency-Key（重複取消回 409 INVALID_TRANSITION）。
- 呼叫 order.cancel（as_staff 為 false，傳入 reason），會寫入（write）訂單狀態、回補庫存與 sold_count；已付款訂單同時模擬退款（不涉及真實金流）。
- 成功回 200 與整張訂單（status 為 cancelled，status_history 最後一筆為 cancelled）。
- 錯誤：NOT_FOUND 回 404（不存在或不屬於本人）；INVALID_TRANSITION 回 409（狀態不是 pending 或 paid，含已取消）；TX_TIMEOUT 回 504；TX_CONFLICT 回 503（帶 Retry-After: 1）。

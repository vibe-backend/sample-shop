# 店員變更訂單狀態

PUT `/shop/v1/staff/orders/{id}/status`。

- 需要 JWT，角色限定 roles: [staff]；非店員回 403。
- 路徑 id 為 uuid；body：status（必填，只能是 shipped 或 cancelled）。其他值、缺少或多餘欄位回 422 VALIDATION_FAILED。
- 不需要 Idempotency-Key（重複送出回 409 INVALID_TRANSITION）。
- 呼叫 order.staff-set-status，會寫入（write）訂單狀態；cancelled 時同時回補庫存與 sold_count，已付款訂單模擬退款（不涉及真實金流）。
- 成功回 200 與整張訂單，另含 buyer（id、display_name、email）。
- 錯誤：403 FORBIDDEN；404 NOT_FOUND；409 INVALID_TRANSITION（shipped 只能由 paid；cancelled 只能由 pending 或 paid）；422 VALIDATION_FAILED；504 TX_TIMEOUT；503 TX_CONFLICT。

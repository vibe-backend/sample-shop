# 店員訂單列表

GET `/shop/v1/staff/orders`。

- 需要 JWT，角色限定 roles: [staff]；非店員回 403。
- query：status（pending、paid、shipped、delivered、cancelled 之一，選填）、cursor（最長 200 字）、limit（1 至 100）。
- 呼叫 order.staff-list，包含所有使用者的訂單，由新到舊；每筆含 status_history 與 buyer（id、display_name、email）。成功回 200，內容為 items 與 next_cursor。
- 錯誤：403 FORBIDDEN；422 VALIDATION_FAILED（status 不合法）。

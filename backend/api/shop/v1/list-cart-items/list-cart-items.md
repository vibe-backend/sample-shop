# 查看購物車

GET `/shop/v1/cart-items`。需要 JWT。

- 沒有 request 欄位。
- 呼叫 cart-item.summary，成功回 200，內容為 items（含 product 摘要與 line_total_cents）與 subtotal_cents。

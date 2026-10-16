# 店員商品列表

GET `/catalog/v1/{slug}/staff/products`。

- 需要 JWT，角色限定 roles: [staff]。
- query：category、active（布林）、cursor（最長 200 字）、limit（1 至 100）。
- 呼叫 product.list，包含 inactive 的商品，每個商品含 options 與 variants；成功回 200，內容為 items 與 next_cursor。

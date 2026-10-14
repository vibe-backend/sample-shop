# 店員商品列表

GET `/catalog/v1/{slug}/staff/products`。

- 需要 JWT，角色限定 roles: [staff]。
- query：category、active（布林）、page（最小 1）、page_size（1 至 100）。
- 呼叫 product.list，包含 inactive 的商品；成功回 200，內容為 items、page、page_size、has_more。

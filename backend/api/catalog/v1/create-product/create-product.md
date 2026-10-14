# 新增商品（店員）

POST `/catalog/v1/{slug}/products`。

- 需要 JWT，角色限定 roles: [staff]。
- body：slug、name、description、category、price_cents、currency、image_urls、stock、active、options（欄位規則同 product model）。規格本身的新增與修改另以 product-variant 管理（端點待定）。
- 呼叫 product.create，成功回 201 與新商品，並帶 Location。
- slug 重複回 409 CONFLICT；驗證不通過回 422 VALIDATION_FAILED。

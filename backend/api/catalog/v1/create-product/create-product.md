# 新增商品（店員）

POST `/catalog/v1/{slug}/products`。

- 需要 JWT，角色限定 roles: [staff]。
- body：slug、name、description、category、price_cents、currency、image_urls、stock、active、options（欄位規則同 product model）。body 若含 variants，v1 一律忽略（不報錯、不寫入）；店員規格管理為後續工作。
- 呼叫 product.create，成功回 201 與新商品，並帶 Location。
- slug 重複回 409 CONFLICT；驗證不通過回 422 VALIDATION_FAILED。

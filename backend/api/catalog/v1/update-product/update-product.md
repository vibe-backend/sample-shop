# 更新商品（店員）

PUT `/catalog/v1/{slug}/products/{id}`。

- 需要 JWT，角色限定 roles: [staff]。
- 必須帶 If-Match（樂觀鎖）。
- body 可含 slug、name、description、category、price_cents、currency、image_urls、stock、active、options，皆選填；body 若含 variants 回 422；規格經專用端點管理。
- 先鎖定 product 列，再驗證 options 變更不會使 active SKU 失效；否則回 409 OPTIONS_IN_USE。
- 呼叫 product.update，成功回 200 與更新後的商品。
- 不存在回 404 NOT_FOUND；缺 If-Match 回 428；版本不符回 412；驗證不通過回 422。

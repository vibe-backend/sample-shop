# 更新商品（店員）

PUT `/catalog/v1/{slug}/products/{id}`。

- 需要 JWT，角色限定 roles: [staff]。
- 必須帶 If-Match（樂觀鎖）。
- body 可含 name、description、category、price_cents、currency、image_urls、stock、active，皆選填。
- 呼叫 product.update，成功回 200 與更新後的商品。
- 不存在回 404 NOT_FOUND；缺 If-Match 回 428；版本不符回 412；驗證不通過回 422。

# 商品詳情（公開）

GET `/catalog/v1/{slug}/products/{id}`。

- 這是公開端點，不需要登入，移除 auth；租戶由路徑中的 slug 決定；不允許公開寫入。
- 依 IP 限流，每分鐘 600 次。
- 路徑參數 id 為 uuid。
- 呼叫 product.get 取得商品；商品不存在時回 404 NOT_FOUND。
- 成功回 200，內容為商品所有欄位。

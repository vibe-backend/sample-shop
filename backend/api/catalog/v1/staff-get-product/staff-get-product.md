# 商品詳情（店員）

GET `/catalog/v1/{slug}/staff/products/{id}`。需要 JWT，roles: [staff]。

- tenant 由 slug 與已驗證身份決定；不同 tenant 不可存取。
- 呼叫 product.detail（include_inactive = true，只由此店員端點指定）。
- 回 200 Product + ETag（含 inactive 商品）；不存在或已刪除回 404，非店員回 403。
- 前端編輯保存原樣 ETag，PUT 更新時放入 If-Match；不能為重試而重新讀取後自動覆寫。

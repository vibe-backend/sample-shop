# 商品列表（公開）

GET `/catalog/v1/{slug}/products`。

- 這是公開端點，不需要登入，移除 auth；租戶由路徑中的 slug 決定；不允許公開寫入。
- 依 IP 限流，每分鐘 600 次。
- query 參數：q（最長 100 字）、category（最長 40 字）、min_price_cents、max_price_cents（整數，最小 0）、sort（price 或 created_at）、order（asc 或 desc）、cursor（最長 200 字）、limit（1 至 100）。
- 呼叫 product.search，成功回 200，內容為 items 與 next_cursor；每個商品含 options 與 variants。
- 驗證不通過回 422 VALIDATION_FAILED。

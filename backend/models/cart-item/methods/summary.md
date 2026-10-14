# summary

列出目前使用者的購物車，並附上商品摘要與金額。

## 做法
- 以參數化 SQL 查詢 cart_items（user_id = ctx.user.id、未刪除）並關聯 products。

## 輸出
- items：每筆含 id、product_id、quantity、product（name、image_url 取 image_urls 第一張、unit_price_cents、currency、in_stock）、line_total_cents（unit_price_cents × quantity）。
- subtotal_cents：所有 line_total_cents 的總和。

此 method 只讀取資料（writes: false）。

# summary

列出目前使用者的購物車，附上商品摘要、所選規格與金額。

## 做法

- 以參數化 SQL 查詢 cart_items（user_id = ctx.user.id、未刪除），關聯 products，並以 sku_id 關聯 product_variants（可能為 null）。

## 輸出

- items：每筆含
  - id、quantity
  - product：id、slug、name、currency、price_cents、in_stock、image_url。有規格時 price_cents、in_stock 取該規格的值，image_url 取規格的 image_url（為 null 時改用商品 image_urls 第一張）；沒有規格時取商品的值，image_url 為 image_urls 第一張或 null。
  - sku：有規格時為 {id, options}，否則為 null。
  - line_total_cents：product.price_cents × quantity。
- subtotal_cents：所有 line_total_cents 的總和。

此 method 只讀取資料（writes: false）。

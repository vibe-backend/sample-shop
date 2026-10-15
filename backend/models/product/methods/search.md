# search

公開的商品搜尋，只回傳 active 為 true 的商品。

## 輸入

- q（選填，名稱關鍵字，不分大小寫的部分比對）
- category（選填）
- min_price_cents、max_price_cents（選填，整數）
- sort（選填）：price 或 created_at，預設 created_at
- order（選填）：asc 或 desc，預設 desc
- cursor（選填，上一頁回傳的 next_cursor）、limit（1 至 100，預設 20）

## 做法

- 以參數化 SQL 查詢 products，條件為 active = true 且未被刪除，再套用上述篩選與排序，取 limit + 1 筆以判斷是否還有下一頁。
- 一併查詢這些商品的 active 規格，依 product 的「規格與彙總」規則計算 price_cents、stock、in_stock；價格篩選與價格排序使用計算後的 price_cents。

## 輸出

- items：每筆含 id、slug、name、description、category、price_cents、currency、image_urls、stock、in_stock、active、created_at、options、variants（每筆含 id、options、price_cents、stock、in_stock、image_url）。
- next_cursor：若還有下一頁則為字串，否則為 null。

此 method 只讀取資料（writes: false）。

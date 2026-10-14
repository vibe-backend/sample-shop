# detail

取得單一商品，附上規格。公開端點只看 active 商品；店員端點可看 inactive。

## 輸入
- id（uuid）、include_inactive（布林，預設 false）。

## 做法
1. 以主鍵查詢 products（未刪除；include_inactive 為 false 時加 active = true）；查無回 `NOT_FOUND`。
2. 查詢此商品的 product_variants（未刪除、active = true）。
3. 有規格時，依 product 的「規格與彙總」規則（含規格全部停用時不可購買）計算 price_cents、stock、in_stock；沒有規格時沿用商品欄位，in_stock 為 stock > 0。

## 輸出
- 商品所有欄位，加上 options（陣列，沒有規格時為空陣列）與 variants（陣列，每筆含 id、options、price_cents、stock、in_stock、image_url）。

## 錯誤
- NOT_FOUND。

此 method 只讀取資料（writes: false）。

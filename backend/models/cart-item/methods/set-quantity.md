# set-quantity

修改目前使用者購物車中某一品項的數量，並依規格檢查庫存。

## 輸入

- id（uuid）、quantity（1 至 99）。

## 做法

1. 以主鍵查詢 cart_items（user_id = ctx.user.id、未刪除）；查無回 `NOT_FOUND`。
2. 有 sku_id 時查詢該規格的 stock（規格須 active、未刪除，否則回 `SKU_NOT_FOUND`）；沒有時查詢商品 stock。
3. quantity 超過可用庫存回 `OUT_OF_STOCK`。
4. 以主鍵更新 quantity，回傳 id、product_id、sku_id、quantity。

## 錯誤

- NOT_FOUND、SKU_NOT_FOUND、OUT_OF_STOCK。

此 method 會寫入資料（writes: true）。

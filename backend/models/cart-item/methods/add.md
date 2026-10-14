# add

把商品加入目前使用者的購物車；同一商品已在購物車時累加數量，而不是新增一列。

## 輸入
- product_id（uuid）、quantity（1 至 99）。

## 做法
1. 查詢 product：必須存在、active 為 true、未刪除；否則回 `PRODUCT_NOT_FOUND`。
2. 查詢目前使用者（ctx.user.id）對此 product_id 已有的 quantity（沒有則為 0）。
3. 新數量 = 原數量 + 輸入 quantity；若超過 99 回 `QUANTITY_LIMIT`；若超過商品 stock 回 `OUT_OF_STOCK`。
4. 已有品項時以主鍵更新 quantity；沒有時新增一列，user_id 用 ctx.user.id。
5. 回傳該品項 id、product_id、quantity。

## 錯誤
- PRODUCT_NOT_FOUND、QUANTITY_LIMIT、OUT_OF_STOCK。

此 method 會寫入資料（writes: true）。

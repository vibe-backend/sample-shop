# manage

店員規格管理（#61），writes: true；所有操作需要 staff，tenant 與 user 只由 ctx 決定。

## 輸入與驗證

- product_id、sku_id（更新時）、If-Match version（更新時）。
- 新增：options、price_cents、stock、active 必填；image_url 可為 null。
- 更新：以上欄位皆可選填，但至少一項；不允許 id、product_id、reserved_stock、version 等內部欄位。
- price_cents、stock 為非負安全整數；active 為 boolean。
- image_url 為 null／空字串或 http(s) 網址，最長 500 字。
- options 鍵集合必須和 product.options name 集合完全相同，每個值屬於對應 values。
- 不符合回 422 VALIDATION_FAILED；同一 product 已存在相同 options 回 409 SKU_EXISTS（包含 inactive）。

## 交易順序

1. 角色驗證（非店員 403）與輸入驗證；更新缺少 If-Match 回 428。
2. 查詢目前租戶的 product（未刪除，含 inactive）並 FOR UPDATE；不存在回 404。
3. 以更新後的完整欄位驗證 options；新增 INSERT version = 1。
4. 更新時再鎖定屬於 product 的 SKU，缺少或 product 不符回 404 SKU_NOT_FOUND。
5. UPDATE 帶 id、product_id、version = If-Match 條件，更新指定欄位並 version + 1。
   不符回 412 PRECONDITION_FAILED；交易回滾。不能寫 reserved_stock。
6. 不改已建立的 order_items 快照。停用／啟用使用 active，不硬刪除。
7. 回傳 SKU（id、options、price_cents、stock、reserved_stock、in_stock、image_url、active、version）與 ETag。
   in_stock = active AND stock > 0。ETag 為引號包住的十進位 version。

## 商品選項與鎖

product.update 共用同一 product 鎖；若修改 options 會令任一 active SKU 不再有效，
回 409 OPTIONS_IN_USE，不自動停用既有 SKU。inactive SKU 可以保留，但再次啟用時必須通過驗證。
所有庫存操作也依 product_id 排序鎖 product，再依 sku_id 排序鎖該商品的 SKU，避免和規格編輯死結。

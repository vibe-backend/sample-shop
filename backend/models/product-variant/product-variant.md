# product-variant

商品規格（SKU），存放在 main 資料庫的 `product_variants` 表。屬於整個商店（租戶）共享的資料。

## 欄位

- product_id：uuid，必填，指向 product。
- options：json 類型，必填；內容為物件，鍵為規格名稱、值為規格值，例如 {顏色: 黑色, 尺寸: 大}；鍵必須對應 product.options 的 name，值必須是該組 values 之一。
- price_cents：整數，必填，最小 0。
- stock：整數，必填，最小 0，預設 0；可售庫存（不含已保留）。
- reserved_stock：整數，必填，最小 0，預設 0；待付款保留數量，呼叫者不可直接提供。實體在手庫存為 stock + reserved_stock；詳見 CONTRACT §15。
- image_url：字串，選填，最長 500 字。
- active：布林，必填，預設 true。

## 一致性

- (product_id, options) 唯一（jsonb 結構相等，鍵順序不影響）。停用後仍保留此組合，新建同組合回 SKU_EXISTS，應重新啟用原 SKU。
- 規格所有寫入先鎖定 product 列，再鎖定 SKU；商品 options 更新共用 product 鎖。
- version：整數，必填，預設 1；每次規格欄位或庫存變更皆加一。更新需要 If-Match（缺少 428，過期 412）。
- stock 更新代表新的可售數量，不能改變 reserved_stock；停用不會釋放既有訂單保留。

## CRUD

- create、get、update（以 If-Match 樂觀鎖）、delete（軟刪除）。
- list：依 product_id 篩選，每頁最多 100 筆。

## 政策

- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

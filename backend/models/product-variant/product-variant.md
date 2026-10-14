# product-variant

商品規格（SKU），存放在 main 資料庫的 `product_variants` 表。屬於整個商店（租戶）共享的資料。

## 欄位
- product_id：uuid，必填，指向 product。
- options：json 類型，必填；內容為物件，鍵為規格名稱、值為規格值，例如 {顏色: 黑色, 尺寸: 大}；鍵必須對應 product.options 的 name，值必須是該組 values 之一。
- price_cents：整數，必填，最小 0。
- stock：整數，必填，最小 0，預設 0。
- image_url：字串，選填，最長 500 字。
- active：布林，必填，預設 true。

## CRUD
- create、get、update（以 If-Match 樂觀鎖）、delete（軟刪除）。
- list：依 product_id 篩選，每頁最多 100 筆。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

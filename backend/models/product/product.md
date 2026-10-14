# product

商品目錄，存放在 main 資料庫的 `products` 表。屬於整個商店（租戶）共享的資料。

## 欄位
- slug：字串，必填，唯一，只允許 a-z0-9-，最長 80 字。
- name：字串，必填，最長 120 字。
- description：字串，選填，最長 4000 字。
- category：字串，必填，最長 40 字。
- price_cents：整數，必填，最小 0。
- currency：字串，必填，固定 3 個大寫字母（例如 TWD），預設 TWD。
- image_urls：字串陣列，選填，最多 10 個網址。
- stock：整數，必填，最小 0，預設 0。
- active：布林，必填，預設 true。

## CRUD
- create、get、update（以 If-Match 樂觀鎖）、delete（軟刪除）。
- list：每頁預設 20 筆、最多 100 筆；可依 created_at、price_cents 排序；可依 category、active 篩選。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

# order-item

訂單品項快照，存放在 main 資料庫的 `order_items` 表。建立後不可修改。

## 欄位
- order_id：uuid，必填，指向 order。
- user_id：uuid，必填；由 ctx.user.id 填入。
- product_id：uuid，必填。
- product_name：字串，必填，最長 120 字（下單當時的名稱）。
- unit_price_cents：整數，必填，最小 0（下單當時的單價）。
- quantity：整數，必填，1 至 99。
- line_total_cents：整數，必填，最小 0。

## 擁有權
- owner-key 為 `user_id`。

## CRUD
- list：依 order_id 篩選，每頁最多 100 筆。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

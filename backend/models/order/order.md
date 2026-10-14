# order

訂單，存放在 main 資料庫的 `orders` 表。

## 欄位
- user_id：uuid，必填；由 ctx.user.id 填入。
- status：字串，必填，只能是 pending、paid、shipped、delivered、cancelled 之一，預設 pending。
- total_cents：整數，必填，最小 0。
- currency：字串，必填，3 個大寫字母。
- idempotency_key：字串，必填，1 至 64 字。
- request_hash：字串，必填，最長 64 字（建立訂單時請求 body 的雜湊，用於判斷同 key 不同 body）。

## 輸出
- get 一併回傳 items（order_items 快照，欄位同 order-item）。

## 擁有權
- owner-key 為 `user_id`：使用者只能讀取自己的訂單。

## CRUD
- get。
- list：每頁預設 20 筆、最多 100 筆，依 created_at 由新到舊排序。
- 不提供 update、delete 給一般使用者。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

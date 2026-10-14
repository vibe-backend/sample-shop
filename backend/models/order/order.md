# order

訂單，存放在 main 資料庫的 `orders` 表。

## 欄位

- user_id：uuid，必填；由 ctx.user.id 填入。
- status：字串，必填，只能是 pending、paid、shipped、delivered、cancelled 之一，預設 pending。
- total_cents：整數，必填，最小 0。
- currency：字串，必填，3 個大寫字母。
- idempotency_key：字串，必填，1 至 64 字。
- shipping_address：json 類型，選填；下單時的收貨地址快照，含 recipient、phone、region、line1 四個字串。之後修改地址簿不影響此快照。
- payment_method：字串，選填，只能是 mock_card、mock_alipay 之一，預設 null；只由 order.pay 寫入。
- paid_at：時間戳記，選填，預設 null；付款成功時由 order.pay 寫入。
- request_hash：字串，必填，最長 64 字（建立訂單時請求 body（含 address_id）的雜湊，用於判斷同 key 不同 body）。

## 冪等與庫存保留

- (user_id, idempotency_key) 資料庫唯一；request_hash 必須和訂單一同寫入，不可只在查詢時比較。
- reservation_expires_at：時間戳記，選填；新訂單為資料庫 now() + 30 分鐘，舊訂單遷移須補期限。
- reservation_active：布林，必填，預設 false；新 pending 訂單为 true，付款、取消或逾期在同一交易中改為 false。
- cancellation_reason：字串，選填，最多 200 字；逾期填付款逾時。
- 庫存語意與鎖順序見 CONTRACT §15；只有持有此訂單列鎖並成功轉換狀態者可以釋放／提交保留。

## 輸出

- get 一併回傳 reservation_expires_at、reservation_active、cancellation_reason、items（order_items 快照，欄位同 order-item）與 status_history（order_status_events 的 status、at，由舊到新，ISO 8601 UTC）。

## 擁有權

- owner-key 為 `user_id`：使用者只能讀取自己的訂單。

## CRUD

- get。
- list：每頁預設 20 筆、最多 100 筆，依 created_at 由新到舊排序。
- 不提供 update、delete；status 只經由 method 轉換：order.pay（pending → paid）、order.cancel（pending／paid → cancelled）、order.confirm-delivery（shipped → delivered）、order.staff-set-status（paid → shipped，或 pending／paid → cancelled）。其他轉換一律回 `INVALID_TRANSITION`。
- 每次狀態轉換（含建立時的 pending）都在同一交易中新增一列 order-status-event。
- 店員經由 order.staff-list 與 order.staff-set-status 存取任何使用者的訂單（不受 owner-key 限制）。

## 政策

- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

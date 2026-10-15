# order-status-event

訂單狀態歷程，存放在 main 資料庫的 `order_status_events` 表。每次訂單狀態轉換（建立、付款、取消、出貨、送達）各新增一列；建立後不可修改或刪除。

## 欄位

- order_id：uuid，必填，指向 order。
- user_id：uuid，必填；訂單買家的 id（與 orders.user_id 相同，店員操作時亦填買家 id，不是店員 id）。
- status：字串，必填，只能是 pending、paid、shipped、delivered、cancelled 之一（轉換後的狀態；建立訂單時為 pending）。
- at：時間戳記，必填，預設 now()；輸出為 ISO 8601 UTC。
- actor：字串，必填，只能是 buyer、staff、system 之一（僅供稽核，不輸出給前端）。

## 輸出

- 嵌入訂單時只輸出 status 與 at，依 at 與 id 由舊到新排序，作為 Order 的 status_history。

## 擁有權

- owner-key 為 `user_id`：買家只能讀取自己訂單的歷程；店員經由 order.staff-list／order.staff-set-status 讀寫。

## CRUD

- 只經由 order.place、order.pay、order.cancel、order.confirm-delivery、order.staff-set-status 新增；不開放 list、update、delete。

## 政策

- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

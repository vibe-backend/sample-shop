# confirm-delivery

買家確認收貨：把本人一張 shipped 訂單改為 delivered。

## 交易規則
- 整個請求在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。
- 逾時與衝突處理同 order.place（`TX_TIMEOUT`、`TX_CONFLICT`）。
- 不需要 Idempotency-Key：delivered 為終止狀態，重複確認回 `INVALID_TRANSITION`。

## 輸入
- id（訂單 uuid，路徑）。

## 做法（依此固定順序）
1. 以主鍵查詢 orders（user_id = ctx.user.id）；不存在或屬於他人回 `NOT_FOUND`。
2. 執行 `UPDATE orders SET status = 'delivered' WHERE id = 訂單 id AND user_id = ctx.user.id AND status = 'shipped'`，並檢查影響列數；為 0（狀態不是 shipped）回 `INVALID_TRANSITION`。
3. 新增 order_status_events 一列：status 為 delivered、at 為 now()、actor 為 buyer。
4. 回傳整張訂單（含 status_history）。

## 錯誤
- NOT_FOUND、INVALID_TRANSITION、TX_TIMEOUT、TX_CONFLICT。

此 method 會寫入資料（writes: true），寫入 order（status）與 order-status-event。

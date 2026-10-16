# staff-set-status

店員變更訂單狀態：出貨（paid → shipped）或取消（pending／paid → cancelled）。

## 權限

- 呼叫者須具備 staff 角色；否則回 `FORBIDDEN`。可操作任何使用者的訂單（仍受租戶 RLS 限制）。

## 交易規則

- 整個請求在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。
- 逾時與衝突處理同 order.place（`TX_TIMEOUT`、`TX_CONFLICT`）。
- 不需要 Idempotency-Key：重複送出相同狀態回 `INVALID_TRANSITION`。

## 輸入

- id（訂單 uuid，路徑）。
- status（必填，只能是 shipped 或 cancelled；其他值或缺少回 `VALIDATION_FAILED`）。

## 做法

1. status 為 cancelled：以 as_staff = true 執行與 order.cancel 完全相同的步驟（含回補庫存、減 sold_count、已付款訂單的模擬退款、新增歷程，actor 為 staff）。
2. status 為 shipped（依此固定順序）：
   1. 以主鍵查詢 orders；不存在回 `NOT_FOUND`。
   2. 執行 `UPDATE orders SET status = 'shipped' WHERE id = 訂單 id AND status = 'paid'`，並檢查影響列數；為 0（狀態不是 paid）回 `INVALID_TRANSITION`。
   3. 新增 order_status_events 一列：status 為 shipped、at 為 now()、actor 為 staff。
3. 回傳整張訂單（含 status_history），另含 buyer：id、display_name、email。

## 錯誤

- FORBIDDEN、NOT_FOUND、VALIDATION_FAILED、INVALID_TRANSITION、TX_TIMEOUT、TX_CONFLICT。

此 method 會寫入資料（writes: true），寫入 order（status）與 order-status-event；取消時另寫入 product、product-variant、payment-attempt（同 order.cancel）。

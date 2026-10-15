# pay

模擬付款：把目前使用者的一張 pending 訂單改為 paid。不涉及真實金流。

## 交易規則

- 整個請求在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。
- 逾時與衝突處理同 order.place（`TX_TIMEOUT`、`TX_CONFLICT`）。

## 輸入

- id（訂單 uuid，路徑）。
- idempotency_key（必填，字串，1 至 64 字）；缺少回 `IDEMPOTENCY_KEY_REQUIRED`。
- method（必填，mock_card 或 mock_alipay）、simulate（必填，success 或 failure）。
- request_hash（字串，body 正規化後的雜湊）。

## 做法（依此固定順序）

1. 以主鍵查詢 orders（user_id = ctx.user.id）；不存在或屬於他人回 `NOT_FOUND`。
2. 查詢 payment_attempts（user_id = ctx.user.id、idempotency_key 相同）。若有：order_id 與 request_hash 都相同，直接回傳此訂單（重送成功的付款）；否則回 `IDEMPOTENCY_KEY_REUSED`。
3. 驗證 method 與 simulate；不通過回 `VALIDATION_FAILED`。
4. 訂單 status 不是 pending（已 paid 或 cancelled 等）回 `ORDER_NOT_PAYABLE`。
5. simulate 為 failure 時回 `PAYMENT_DECLINED`；不寫入任何資料，訂單維持 pending，key 不保留。
6. 執行 `UPDATE orders SET status = 'paid', payment_method = method, paid_at = now() WHERE id = 訂單 id AND user_id = ctx.user.id AND status = 'pending'`，並檢查影響列數；為 0（並發的另一筆付款已成功）回 `ORDER_NOT_PAYABLE`。
7. 新增 payment_attempts 一列：order_id、idempotency_key、request_hash、method，user_id 用 ctx.user.id。
8. 新增 order_status_events 一列：status 為 paid、at 為 now()、actor 為 buyer。
9. 回傳整張訂單（id、status、payment_method、paid_at、status_history、shipping_address、items、total_cents、currency、created_at）。

## 錯誤

- NOT_FOUND、IDEMPOTENCY_KEY_REQUIRED、IDEMPOTENCY_KEY_REUSED、VALIDATION_FAILED、ORDER_NOT_PAYABLE、PAYMENT_DECLINED、TX_TIMEOUT、TX_CONFLICT。

此 method 會寫入資料（writes: true），寫入 order（status、payment_method、paid_at）、payment-attempt 與 order-status-event。

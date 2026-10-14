# cancel

取消訂單並回補庫存。買家（本人）與店員共用此 method；若訂單已付款，同時進行模擬退款（不涉及真實金流，不會有任何款項移動）。

## 交易規則
- 整個請求在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。
- 寫入依固定順序進行，並在 SET LOCAL ROLE 之下執行；不跨請求、不跨資料庫、不使用分散式交易。
- 逾時與衝突處理同 order.place（`TX_TIMEOUT`、`TX_CONFLICT`）。
- 不需要 Idempotency-Key：cancelled 為終止狀態，重複取消回 `INVALID_TRANSITION`。

## 輸入
- id（訂單 uuid，路徑）。
- as_staff（布林，由 API 決定，呼叫者不可提供）：false 時只限 ctx.user.id 本人的訂單；true 時呼叫者須具備 staff 角色，可取消任何人的訂單。

## 做法（依此固定順序）
1. 以主鍵查詢 orders 並 `FOR UPDATE` 鎖定；as_staff 為 false 時加上 user_id = ctx.user.id。不存在或（買家）屬於他人回 `NOT_FOUND`。
2. status 不是 pending 或 paid 回 `INVALID_TRANSITION`。記下原本的 status。
3. 執行 `UPDATE orders SET status = 'cancelled' WHERE id = 訂單 id AND status = 原本的 status`，並檢查影響列數；為 0（並發的付款／取消／出貨已先完成）回 `INVALID_TRANSITION`。
4. 回補庫存：查詢此訂單的 order_items；有 sku_id 的品項以 `UPDATE product_variants SET stock = stock + 數量 WHERE id = sku_id`，沒有規格的品項以同樣方式更新 products；依 sku_id／product_id 由小到大的順序逐筆執行（與 order.place 相同順序以降低死結機率）。同時將對應 products 的 sold_count 減去數量（有規格時減在所屬商品，最小為 0）。已停用或軟刪除的商品／規格仍回補。
5. 若原本的 status 為 paid（模擬退款）：以 `UPDATE payment_attempts SET refunded_at = now() WHERE order_id = 訂單 id AND refunded_at IS NULL` 標記最新一筆成功付款為已退款（每張訂單最多一筆成功付款）。orders.payment_method 與 paid_at 保留不變。不呼叫任何外部金流，不移動任何款項。
6. 新增 order_status_events 一列：order_id、user_id（訂單買家）、status 為 cancelled、at 為 now()、actor 為 buyer 或 staff。
7. 回傳整張訂單（id、status、payment_method、paid_at、status_history、shipping_address、items、total_cents、currency、created_at）；as_staff 為 true 時另含 buyer（id、display_name、email）。

## 錯誤
- NOT_FOUND、FORBIDDEN、INVALID_TRANSITION、TX_TIMEOUT、TX_CONFLICT。

此 method 會寫入資料（writes: true），寫入 order（status）、product（stock、sold_count）、product-variant（stock）、payment-attempt（refunded_at）、order-status-event（應經由各自的 method）。

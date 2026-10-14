# place

以目前使用者的購物車建立訂單。

## 交易規則
- 整個請求在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。
- 寫入依固定順序進行，並在 SET LOCAL ROLE 之下執行；不跨請求、不跨資料庫、不使用分散式交易。
- 逾時：單一 SQL 5 秒、整個交易 10 秒、交易中閒置 5 秒；逾時時交易回滾並回 `TX_TIMEOUT`。
- 發生死結（40P01）或序列化失敗（40001）時交易回滾並回 `TX_CONFLICT`（可重試）；平台不自動重試此寫入。

## 輸入
- idempotency_key（必填，字串，1 至 64 字）；缺少回 `IDEMPOTENCY_KEY_REQUIRED`。
- address_id（uuid）；缺少回 `ADDRESS_REQUIRED`。
- request_hash（字串，請求 body 正規化後的雜湊；body 含 address_id，因此同一 key 但不同地址視為不同 body）。

## 做法（依此固定順序）
1. 查詢此使用者是否已有相同 idempotency_key 的訂單；若有且 request_hash 相同，直接回傳該訂單，不重複建立；若 request_hash 不同回 `IDEMPOTENCY_KEY_REUSED`。
2. 以 address_id 查詢 addresses（user_id = ctx.user.id、未刪除）；查無（不存在或屬於他人）回 `ADDRESS_NOT_FOUND`。
3. 查詢購物車（cart_items，user_id = ctx.user.id、未刪除），關聯 products 與 product_variants；若為空回 `CART_EMPTY`。
4. 任一商品或所選規格已 inactive 或刪除（或商品有 options 但規格全部停用），回 `PRODUCT_UNAVAILABLE`，並在錯誤細節附上所有受影響的 cart_item id（cart_item_ids）。
5. 扣減庫存：有 sku_id 的品項以 `UPDATE product_variants SET stock = stock - 數量 WHERE id = sku_id AND stock >= 數量`，沒有規格的品項以同樣方式更新 products；依 sku_id／product_id 由小到大的順序逐筆執行，並檢查影響列數，任一筆為 0 即回 `OUT_OF_STOCK`（整個交易回滾）。同時將對應 products 的 sold_count 加上數量（有規格時加在所屬商品）。
6. 新增 orders 一列：status 為 pending、payment_method 與 paid_at 為 null、shipping_address 為步驟 2 地址的快照（recipient、phone、region、line1）、total_cents 為各品項單價 × 數量的總和、currency、idempotency_key。
7. 逐項新增 order_items 快照：product_id、sku_id、sku_options、name、unit_price_cents（有規格時為規格價格）、quantity、line_total_cents。
8. 新增 order_status_events 一列：status 為 pending、at 為 now()、actor 為 buyer。
9. 軟刪除此使用者所有 cart_items（清空購物車）。
10. 回傳訂單 id、status、status_history、shipping_address、items、total_cents、currency、created_at。

## 錯誤
- IDEMPOTENCY_KEY_REQUIRED、IDEMPOTENCY_KEY_REUSED、ADDRESS_REQUIRED、ADDRESS_NOT_FOUND、CART_EMPTY、PRODUCT_UNAVAILABLE、OUT_OF_STOCK、TX_TIMEOUT、TX_CONFLICT。

此 method 會寫入資料（writes: true），寫入 product（stock、sold_count）、product-variant、order（含 shipping_address）、order-item、order-status-event、cart-item（應經由各自的 method）。

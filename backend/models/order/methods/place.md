# place

以目前使用者的購物車建立訂單。

## 輸入
- idempotency_key（選填，字串，最長 64 字）。

## 做法（同一個 transaction）
1. 若有 idempotency_key，先查詢此使用者是否已有相同 key 的訂單；若有，直接回傳該訂單，不重複建立。
2. 查詢購物車（cart_items 關聯 products，user_id = ctx.user.id）；若為空回 `CART_EMPTY`。
3. 任一商品 inactive 回 `PRODUCT_UNAVAILABLE`；任一商品 stock 小於 quantity 回 `OUT_OF_STOCK`。
4. 新增 orders 一列：status 為 pending、total_cents 為各品項 unit_price_cents × quantity 的總和、currency、idempotency_key。
5. 逐項新增 order_items 快照（product_name、unit_price_cents、quantity、line_total_cents）。
6. 扣減 products.stock（以主鍵限定）。
7. 軟刪除此使用者所有 cart_items（清空購物車）。
8. 回傳訂單 id、status、items、total_cents、currency、created_at。

## 錯誤
- CART_EMPTY、PRODUCT_UNAVAILABLE、OUT_OF_STOCK。

此 method 會寫入資料（writes: true），並會寫入 order-item、product、cart-item（應經由各自的 method）。

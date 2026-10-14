# payment-attempt

模擬付款的冪等紀錄，存放在 main 資料庫的 `payment_attempts` 表。只記錄**成功**的付款；失敗（PAYMENT_DECLINED）不寫入，因此同一 Idempotency-Key 可重試。

## 欄位
- user_id：uuid，必填；由平台以 ctx.user.id 填入，呼叫者不可提供。
- order_id：uuid，必填，指向 order。
- idempotency_key：字串，必填，1 至 64 字。
- request_hash：字串，必填，最長 64 字（付款請求 body 正規化後的雜湊）。
- method：字串，必填，只能是 mock_card、mock_alipay 之一。
- refunded_at：時間戳記，選填，預設 null；已付款訂單被取消時由 order.cancel 寫入，表示模擬退款（不涉及真實金流，沒有任何款項移動）。

## 規則
- user_id 與 idempotency_key 的組合唯一。
- 每張訂單最多一筆紀錄（order_id 唯一）。

## 擁有權
- owner-key 為 `user_id`：使用者只能讀寫自己的紀錄。

## CRUD
- 只經由 order.pay 新增，refunded_at 只經由 order.cancel 更新；不開放 list、update、delete。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

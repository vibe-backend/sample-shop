# staff-list

店員列出所有使用者的訂單，使用 cursor 分頁，由新到舊。

## 權限

- 呼叫者須具備 staff 角色；否則回 `FORBIDDEN`。此 method 不套用 owner-key 限制（仍受租戶 RLS 限制）。

## 輸入

- status（選填，pending、paid、shipped、delivered、cancelled 之一；其他值回 `VALIDATION_FAILED`）。
- cursor（選填，上一頁回傳的 next_cursor，最長 200 字）、limit（1 至 100，預設 20）。

## 做法

- 以參數化 SQL 查詢 orders（有 status 時依此篩選），關聯 users 取得買家，依 created_at 與 id 由新到舊排序，取 limit + 1 筆判斷是否還有下一頁。

## 輸出

- items：每筆為整張訂單（id、status、payment_method、paid_at、status_history（由舊到新）、shipping_address、items、total_cents、currency、created_at），另含 buyer：id、display_name、email。
- next_cursor：若還有下一頁則為字串，否則為 null。

此 method 只讀取資料（writes: false）。

# history

列出目前使用者的訂單，使用 cursor 分頁，由新到舊。

## 輸入
- cursor（選填，上一頁回傳的 next_cursor）、limit（1 至 100，預設 20）。

## 做法
- 以參數化 SQL 查詢 orders（user_id = ctx.user.id），依 created_at 與 id 由新到舊排序，取 limit + 1 筆判斷是否還有下一頁。

## 輸出
- items：每筆含 id、status、total_cents、currency、created_at。
- next_cursor：若還有下一頁則為字串，否則為 null。

此 method 只讀取資料（writes: false）。

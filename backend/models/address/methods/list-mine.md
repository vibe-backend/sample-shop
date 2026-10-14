# list-mine

列出目前使用者的所有收貨地址。

## 做法
1. 查詢 addresses（user_id = ctx.user.id、未刪除）。
2. 排序：is_default 為 true 的排最前，其餘依 created_at 由新到舊。
3. 回傳陣列，每項含 id、recipient、phone、region、line1、is_default、created_at（不分頁，最多 20 筆）。

此 method 只讀取資料。

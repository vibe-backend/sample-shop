# register

建立新顧客帳號。

## 輸入

- email（合法 email）、password（明文，8 至 72 字）、display_name（1 至 50 字）。

## 做法

1. 查詢是否已有相同 email（不分大小寫）的使用者；若有，失敗並回 `EMAIL_TAKEN`。
2. 用 hash-password 將 password 雜湊。
3. 新增一列 users：email 轉小寫、password_hash、display_name、roles 為空陣列。
4. 回傳 id、email、display_name、roles、created_at。

## 錯誤

- EMAIL_TAKEN：email 已被使用。

此 method 會寫入資料（writes: true）。

# user

商店的顧客與店員帳號，存放在 main 資料庫的 `users` 表。

## 欄位
- email：字串，必填，唯一，合法 email 格式，最長 254 字。
- password_hash：密碼類型（password），必填；永遠不可出現在任何輸出中。
- display_name：字串，必填，1 至 50 字。
- roles：字串陣列，預設為空陣列；店員帳號含 `staff`。由平台管理，使用者不可自行設定。

## 擁有權
- owner-key 為 `id`：一般使用者只能讀取自己這一列。

## CRUD
- 只提供 get（讀取自己的資料）。不提供 list、update、delete。

## 政策
- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

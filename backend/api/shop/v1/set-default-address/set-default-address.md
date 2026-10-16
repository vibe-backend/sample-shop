# 設為預設地址

POST `/shop/v1/addresses/{id}/default`。需要 JWT，只限本人的地址。

- 路徑 id 為 uuid；body 為空物件 `{}`（有任何欄位回 422）。
- 呼叫 address.set-default，會寫入（write）地址資料；在同一交易中先鎖 user 列、清除舊的預設，再設新預設（`addresses_one_default` 同時只允許一個）。成功回 200 與該地址（is_default 為 true）。
- 錯誤：不存在、屬於他人或已刪除回 404 ADDRESS_NOT_FOUND。

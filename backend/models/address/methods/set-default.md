# set-default

把目前使用者的一個收貨地址設為預設，並在同一交易中清除舊的預設。

## 交易規則

- 在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。

## 輸入

- id（地址 uuid，路徑）。

## 做法（依此固定順序）

先以 `SELECT id FROM users WHERE id = ctx.user.id FOR UPDATE` 取得共用的每人地址簿鎖；接著才執行以下讀寫。create、remove、set-default（以及 update）必須用同一鎖，並於 runtime 交易結束時釋放。清除舊預設後再設新預設，使部分唯一索引 `addresses_one_default` 始終只允許一個未刪除的預設。

1. 以主鍵查詢 addresses（user_id = ctx.user.id、deleted_at 為 null）；不存在、屬於他人或已軟刪除回 `ADDRESS_NOT_FOUND`。
2. 執行 `UPDATE addresses SET is_default = false WHERE user_id = ctx.user.id AND is_default = true AND id <> 地址 id`。
3. 執行 `UPDATE addresses SET is_default = true WHERE id = 地址 id AND user_id = ctx.user.id AND deleted_at IS NULL`；影響列數為 0 回 `ADDRESS_NOT_FOUND`（整個交易回滾）。
4. 回傳 id、recipient、phone、region、line1、is_default、created_at。已是預設時仍回 200 與該地址。

## 錯誤

- ADDRESS_NOT_FOUND。

此 method 會寫入資料（writes: true）。

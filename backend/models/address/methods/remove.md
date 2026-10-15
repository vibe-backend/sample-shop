# remove

軟刪除目前使用者的一個收貨地址；若刪除的是預設地址，由剩餘地址中最新建立的一個遞補為預設。

## 交易規則

- 在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。

## 輸入

- id（地址 uuid，路徑）。

## 做法（依此固定順序）

1. 執行 `UPDATE addresses SET deleted_at = now(), is_default = false WHERE id = 地址 id AND user_id = ctx.user.id AND deleted_at IS NULL RETURNING 原本的 is_default`；影響列數為 0（不存在、屬於他人或已刪除）回 `ADDRESS_NOT_FOUND`。
2. 若原本是預設：以 `UPDATE addresses SET is_default = true WHERE id = (SELECT id FROM addresses WHERE user_id = ctx.user.id AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1)` 遞補。沒有剩餘地址時不做任何事（使用者沒有預設地址）。
3. 不回傳內容（API 回 204）。

## 錯誤

- ADDRESS_NOT_FOUND。

此 method 會寫入資料（writes: true）。已軟刪除的地址不出現在 address.list-mine、不計入 20 個上限，下單時以其 id 下單回 `ADDRESS_NOT_FOUND`；已下單訂單的 shipping_address 為快照（不參照地址 id），不受影響。

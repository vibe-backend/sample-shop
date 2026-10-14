# remove

軟刪除目前使用者的一個收貨地址；若刪除的是預設地址，由剩餘地址中最新建立的一個遞補為預設。

## 交易規則

- 在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。

## 輸入

- id（地址 uuid，路徑）。

## 做法（依此固定順序）

先以 `SELECT id FROM users WHERE id = ctx.user.id FOR UPDATE` 取得共用的每人地址簿鎖；接著才執行以下讀写。所有地址寫入必須用同一鎖，並於 runtime 交易結束時釋放。

1. 以 `SELECT id, is_default FROM addresses WHERE id = 地址 id AND user_id = ctx.user.id AND deleted_at IS NULL FOR UPDATE` 讀取並保存原本的 is_default；不存在回 `ADDRESS_NOT_FOUND`。接著 `UPDATE addresses SET deleted_at = now(), is_default = false WHERE id = 地址 id AND user_id = ctx.user.id AND deleted_at IS NULL`，檢查影響列數。不可從 UPDATE 的 RETURNING is_default 讀取舊值，因為那是更新後的 false。
2. 若原本是預設：以 `UPDATE addresses SET is_default = true WHERE id = (SELECT id FROM addresses WHERE user_id = ctx.user.id AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1)` 遞補。沒有剩餘地址時不做任何事（使用者沒有預設地址）。
3. 不回傳內容（API 回 204）。

## 錯誤

- ADDRESS_NOT_FOUND。

此 method 會寫入資料（writes: true）。已軟刪除的地址不出現在 address.list-mine、不計入 20 個上限，下單時以其 id 下單回 `ADDRESS_NOT_FOUND`；已下單訂單的 shipping_address 為快照（不參照地址 id），不受影響。

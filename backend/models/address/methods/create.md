# create

為目前使用者新增一個收貨地址。

## 交易規則

- 在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。

## 輸入

- recipient、phone、region、line1（皆必填，規則同 address model）；is_default（布林，選填，預設 false）。

## 做法（依此固定順序）

先以 `SELECT id FROM users WHERE id = ctx.user.id FOR UPDATE` 取得共用的每人地址簿鎖；接著才執行以下讀寫。create、remove、set-default（以及 update）必須用同一鎖，並於 runtime 交易結束時釋放。鎖定 addresses 的空集合不能序列化第一次新增。

有效預設由部分唯一索引 `addresses_one_default`（`user_id WHERE deleted_at IS NULL AND is_default`）強制。20 筆上限在持有此 user 鎖之後計數，並由 BEFORE INSERT OR UPDATE trigger `addresses_limit` 對同一 user 列加鎖再強制一次；已達 20 回 `ADDRESS_LIMIT`。

1. 驗證並正規化輸入（phone 正規化、recipient 與 line1 去除前後空白）；不通過回 `VALIDATION_FAILED`。
2. 在持有 user 鎖之後，計算此使用者（ctx.user.id）未刪除（deleted_at 為 null）的地址數；已達 20 回 `ADDRESS_LIMIT`。
3. 若此使用者目前沒有未刪除的地址，新地址一律設為預設（is_default = true）。
4. 若新地址要設為預設，先以 `UPDATE addresses SET is_default = false WHERE user_id = ctx.user.id AND is_default = true` 清除舊的預設。
5. 新增 addresses 一列，user_id 用 ctx.user.id。第二筆有效預設由 `addresses_one_default` 拒絕；第 21 筆由 `addresses_limit` 拒絕。
6. 回傳 id、recipient、phone、region、line1、is_default、created_at。

## 錯誤

- VALIDATION_FAILED、ADDRESS_LIMIT。

此 method 會寫入資料（writes: true）。

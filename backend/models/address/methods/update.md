# update

以 AddressInput 完整取代目前使用者的一個收貨地址。不會變更預設地址。

## 交易規則

- 在 runtime 提供的單一交易中執行，隔離等級 READ COMMITTED；SQL 中不得出現 BEGIN、COMMIT、ROLLBACK 或 SAVEPOINT。

## 輸入

- id（地址 uuid，路徑）。
- recipient、phone、region、line1（皆必填，規則同 address model）；is_default（選填，會被忽略，不報錯也不寫入）。

## 做法（依此固定順序）

先以 `SELECT id FROM users WHERE id = ctx.user.id FOR UPDATE` 取得共用的每人地址簿鎖；接著才執行以下讀寫。所有地址寫入必須用同一鎖，並於 runtime 交易結束時釋放。此 method 不變更 is_default，也不改變未刪除筆數。

1. 以主鍵查詢 addresses（user_id = ctx.user.id、deleted_at 為 null）；不存在、屬於他人或已軟刪除回 `ADDRESS_NOT_FOUND`。
2. 驗證並正規化輸入（同 address.create）；不通過回 `VALIDATION_FAILED`。
3. 執行 `UPDATE addresses SET recipient = …, phone = …, region = …, line1 = … WHERE id = 地址 id AND user_id = ctx.user.id AND deleted_at IS NULL`；is_default 不變。影響列數為 0 回 `ADDRESS_NOT_FOUND`。
4. 回傳 id、recipient、phone、region、line1、is_default、created_at。

## 錯誤

- ADDRESS_NOT_FOUND、VALIDATION_FAILED。

此 method 會寫入資料（writes: true）。已下單訂單的 shipping_address 為快照，不受影響。

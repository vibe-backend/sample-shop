# address

使用者的收貨地址簿，存放在 main 資料庫的 `addresses` 表。欄位名稱與前端 sample-shop PR #64 `types.ts` 的 `Address` 一致。

## 欄位

- user_id：uuid，必填；由平台以 ctx.user.id 填入，呼叫者不可提供。
- recipient：字串，必填，去除前後空白後 1 至 50 字。
- phone：字串，必填；8 位香港電話號碼，首位 2 至 9。儲存前先正規化：移除空白與連字號，只有整段符合 `^(?:\+852|852)([2-9][0-9]{7})$` 時才移除國碼。8 位號碼如 `85212345` 必須原樣保留；其餘輸入最後須符合 `^[2-9][0-9]{7}$`。
- region：字串，必填，只能是 香港島、九龍、新界、離島 之一。
- line1：字串，必填，詳細地址，去除前後空白後 5 至 200 字。
- is_default：布林，必填，預設 false。只經由 address.create（第一個地址或指定預設）、address.set-default 與 address.remove（遞補）變更。
- deleted_at：時間戳記，選填，預設 null；由 address.remove 寫入（軟刪除）。

## 擁有權

- owner-key 為 `user_id`：使用者只能讀寫自己的地址。

## 規則

- address.create、address.update、address.remove、address.set-default 皆先鎖定目前租戶的 user 列（`SELECT id FROM users WHERE id = ctx.user.id FOR UPDATE`），再讀寫地址。鎖定空地址集合並不能保護第一次新增，必須共用此 user 鎖。create、remove、set-default 都在這把鎖之下變更預設或筆數。
- 資料庫另以部分唯一索引 `addresses_one_default` 保護每人唯一預設（`addresses(user_id) WHERE deleted_at IS NULL AND is_default`）。
- 每位使用者最多 20 個地址（只計 deleted_at 為 null 者）。上限檢查必須在上述 user 鎖之後進行。BEFORE INSERT OR UPDATE trigger `addresses_limit`（函式 `shop_check_address_limit`）在新增或恢復地址時對同一 user 列 `FOR UPDATE`，再計數未刪除地址；已達 20 則拒絕（`ADDRESS_LIMIT`）。此 trigger 與 method 共用同一把 user 鎖。
- 每位使用者最多一個 is_default 為 true 的地址；已刪除的地址 is_default 一律為 false。
- 有未刪除地址時恰有一個預設；沒有未刪除地址時沒有預設。
- 已軟刪除的地址對所有操作（列表、修改、刪除、設為預設、下單）都視為不存在，回 `ADDRESS_NOT_FOUND`。

## CRUD

- 只經由 address.list-mine、address.create、address.update、address.remove（軟刪除）、address.set-default 存取；不開放內建 update、delete。
- 訂單的 orders.shipping_address 是下單時的快照（不存 address_id 參照），修改或刪除地址不影響既有訂單。

## 政策

- 啟用並強制 RLS（租戶欄位由平台自動加入，不需宣告）。

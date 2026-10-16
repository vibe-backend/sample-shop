# 新增收貨地址

POST `/shop/v1/addresses`。需要 JWT。

- body：recipient、phone、region、line1（皆必填）、is_default（布林，選填）。
- 呼叫 address.create，會寫入（write）一筆地址資料。成功回 201 與該地址，並帶 Location。
- 第一個地址自動成為預設；新地址設為預設時會清除舊的預設。新增、修改、刪除與設為預設共用每人 user 列鎖；唯一預設索引 `addresses_one_default` 與上限 trigger `addresses_limit` 見 address model 與 CONTRACT §12。
- 錯誤：驗證不通過回 422 VALIDATION_FAILED；已有 20 個地址回 422 ADDRESS_LIMIT。

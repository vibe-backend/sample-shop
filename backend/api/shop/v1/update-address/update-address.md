# 修改收貨地址

PUT `/shop/v1/addresses/{id}`。需要 JWT，只限本人的地址。

- 路徑 id 為 uuid；body 為 AddressInput：recipient、phone、region、line1（皆必填）、is_default（選填，會被忽略）。完整取代地址內容。
- 呼叫 address.update，會寫入（write）一筆地址資料。成功回 200 與該地址。
- 不變更預設地址；要變更預設請用 POST `/shop/v1/addresses/{id}/default`。
- 錯誤：不存在、屬於他人或已刪除回 404 ADDRESS_NOT_FOUND；驗證不通過或未宣告欄位回 422 VALIDATION_FAILED。

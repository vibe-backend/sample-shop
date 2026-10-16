# 刪除收貨地址

DELETE `/shop/v1/addresses/{id}`。需要 JWT，只限本人的地址。

- 路徑 id 為 uuid。
- 呼叫 address.remove（軟刪除），會寫入（write）地址資料。成功回 204，無 body。
- 刪除預設地址時，在同一交易中先鎖 user 列、保存原本的 is_default，再由剩餘地址中最新建立的一個遞補為預設；刪除最後一個地址後沒有預設地址。不可用更新後的 is_default 判斷舊預設。
- 已下單訂單的收貨地址快照不受影響。
- 錯誤：不存在、屬於他人或已刪除回 404 ADDRESS_NOT_FOUND。

# 列出收貨地址

GET `/shop/v1/addresses`。需要 JWT，只回傳本人的地址。

- 沒有 request 欄位。
- 呼叫 address.list-mine，成功回 200，內容為 Address 陣列（預設地址排最前；不分頁）。

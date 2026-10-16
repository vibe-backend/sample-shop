# 移除購物車品項

DELETE `/shop/v1/cart-items/{id}`。需要 JWT。

- 路徑 id 為 uuid。
- 呼叫 cart-item.delete（軟刪除，只限本人）；成功後回傳整個購物車；不存在回 404 NOT_FOUND。
- cart-item.delete 成功後，再呼叫 cart-item.summary，回應內容改為整個購物車（items 與 subtotal_cents），狀態碼 200。

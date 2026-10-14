# 移除購物車品項

DELETE `/shop/v1/cart-items/{id}`。需要 JWT。

- 路徑 id 為 uuid。
- 呼叫 cart-item.delete（軟刪除，只限本人）；成功回 204；不存在回 404 NOT_FOUND。

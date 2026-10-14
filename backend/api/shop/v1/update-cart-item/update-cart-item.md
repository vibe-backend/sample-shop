# 修改購物車數量

PUT `/shop/v1/cart-items/{id}`。需要 JWT。

- 路徑 id 為 uuid；body：quantity（整數 1 至 99，必填）。
- 呼叫 cart-item.update，只能修改自己的品項；成功回 200 與品項。
- 不存在或不屬於本人回 404 NOT_FOUND；驗證不通過回 422。

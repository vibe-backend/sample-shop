# 加入購物車

POST `/shop/v1/cart-items`。需要 JWT。

- body：product_id（uuid，必填）、quantity（整數 1 至 99，必填）。
- 呼叫 cart-item.add；同商品會累加數量。成功回 201 與品項（id、product_id、quantity）。
- 錯誤：PRODUCT_NOT_FOUND 回 404；OUT_OF_STOCK 回 409；QUANTITY_LIMIT 回 422；驗證不通過回 422 VALIDATION_FAILED。

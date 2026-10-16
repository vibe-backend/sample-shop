# 修改購物車數量

PUT `/shop/v1/cart-items/{id}`。需要 JWT。

- 路徑 id 為 uuid；body：quantity（整數 1 至 99，必填）。
- 呼叫 cart-item.set-quantity（只限本人，依規格檢查庫存）。
- cart-item.set-quantity 成功後，再呼叫 cart-item.summary，回應內容為整個購物車（items 與 subtotal_cents），狀態碼 200。
- 錯誤：NOT_FOUND 回 404；SKU_NOT_FOUND 回 404；OUT_OF_STOCK 回 409；驗證不通過回 422。

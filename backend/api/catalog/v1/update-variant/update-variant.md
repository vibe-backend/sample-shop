# 更新規格（店員）

PUT `/catalog/v1/{slug}/products/{id}/variants/{sku_id}`。需要 JWT，roles: [staff]；非店員回 403 FORBIDDEN。

- body 為部分 VariantInput；If-Match 必填，解析為 version；product_id、sku_id 取 path。
- 呼叫 product-variant.manage；tenant、user 只由 ctx 決定。
- 成功回 200 ProductVariant + 新 ETag。
- 404 NOT_FOUND／SKU_NOT_FOUND、422 VALIDATION_FAILED、409 SKU_EXISTS、412 PRECONDITION_FAILED、428（更新缺少 If-Match）。
- 停用使用 PUT active = false，不硬刪除、不改已建立的訂單快照。

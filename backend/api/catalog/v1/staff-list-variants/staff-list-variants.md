# 列出規格（店員）

GET `/catalog/v1/{slug}/staff/products/{id}/variants`。需要 JWT，roles: [staff]；非店員回 403 FORBIDDEN。

- 無 body；product_id 取 path id。
- 呼叫 product-variant.staff-list；tenant、user 只由 ctx 決定。
- 成功回 200 ProductVariant[]（含 inactive）。
- 404 NOT_FOUND／SKU_NOT_FOUND、422 VALIDATION_FAILED、409 SKU_EXISTS、412 PRECONDITION_FAILED、428（更新缺少 If-Match）。
- 停用使用 PUT active = false，不硬刪除、不改已建立的訂單快照。

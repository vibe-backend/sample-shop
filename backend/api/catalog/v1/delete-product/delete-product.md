# 刪除商品（店員）

DELETE `/catalog/v1/{slug}/products/{id}`。

- 需要 JWT，角色限定 roles: [staff]。
- 呼叫 product.delete（軟刪除），成功回 204。不存在回 404 NOT_FOUND。

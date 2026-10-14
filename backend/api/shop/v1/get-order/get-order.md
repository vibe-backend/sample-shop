# 訂單詳情

GET `/shop/v1/orders/{id}`。需要 JWT。

- 路徑 id 為 uuid。
- 呼叫 order.get（只限本人），成功回 200 與訂單；不存在或不屬於本人回 404 NOT_FOUND。

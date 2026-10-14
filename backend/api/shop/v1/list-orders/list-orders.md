# 訂單列表

GET `/shop/v1/orders`。需要 JWT。

- query：page（最小 1）、page_size（1 至 100）。
- 呼叫 order.list，只列出本人的訂單，依 created_at 由新到舊；成功回 200，內容為 items、page、page_size、has_more。

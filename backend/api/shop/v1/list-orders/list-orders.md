# 訂單列表

GET `/shop/v1/orders`。需要 JWT。

- query：cursor（最長 200 字）、limit（1 至 100）。
- 呼叫 order.history，只列出本人的訂單；成功回 200，內容為 items 與 next_cursor。

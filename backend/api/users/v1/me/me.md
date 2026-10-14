# 目前使用者

GET `/users/v1/me`。需要 JWT（任何已登入使用者）。

- 沒有 request 欄位。
- 以 user.get 讀取 id 等於登入者的使用者。
- 成功回 200，內容為 id、email、display_name、roles。
- 查無資料回 404 NOT_FOUND。

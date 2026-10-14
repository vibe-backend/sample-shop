# 註冊

POST `/users/v1/{slug}/register`。

- 公開端點，移除 auth；租戶由路徑 slug 決定；這是公開寫入（public-writes: true），只寫入 email、password_hash、display_name。
- 依 IP 限流，每分鐘 10 次。
- body：email（合法 email，必填）、password（8 至 72 字，必填）、display_name（1 至 50 字，必填）。
- 呼叫 user.register，成功回 201 與 id、email、display_name、roles。
- EMAIL_TAKEN 回 409；驗證不通過回 422。

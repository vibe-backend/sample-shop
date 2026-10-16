# 登入

POST `/users/v1/{slug}/login`。

- 公開端點，移除 auth；租戶由路徑 slug 決定；不寫入使用者資料。
- 依 IP 限流，每分鐘 10 次。
- body：email、password，皆必填。
- 呼叫 user.login，成功回 200 與 access_token 與 expires_at。
- INVALID_CREDENTIALS 回 401。

# catalog

商品目錄 API。

- provider 只允許 main，預設 main。
- 預設需要 JWT 驗證；公開端點會在各自 feature 中明確移除驗證，店員端點在各自 feature 中要求角色 staff。
- 預設逾時 10 秒，body 上限 1MB。

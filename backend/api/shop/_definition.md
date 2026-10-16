# shop

購物車與訂單 API。

- provider 只允許 main，預設 main。
- 所有端點都需要 JWT（任何已登入使用者），資料只限本人；例外：`/staff/` 路徑下的端點角色限定 roles: [staff]，可存取所有使用者的訂單。
- 預設逾時 10 秒，body 上限 1MB。

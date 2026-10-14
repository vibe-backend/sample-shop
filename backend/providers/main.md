# main

主要的 PostgreSQL 資料庫。

- 連線字串由 secret `PG_MAIN` 提供。
- 租戶隔離採 schema 模式，並強制啟用 RLS。
- 不與其他專案共用。
- 連線池 10，單一 SQL 逾時 5 秒。
- migration 放在 `migrations/main`。

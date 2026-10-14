# 未付款訂單逾期 worker

`expire-orders.sh` 每次處理最多 100 張逾期訂單，在獨立的 PostgreSQL 交易中執行。
部署 scheduler 每分鐘為每個租戶執行一次；繁忙租戶可提高執行頻率。
瀏覽器關閉時仍由部署的 scheduler 執行，前端 polling 只負責顯示結果。

## 部署條件

1. SDK 產生並部署基礎資料表後，在每個租戶 schema 的單一交易中依序執行
   `migrations/main/001_reservations.sql`、`migrations/main/002_expiry_function.sql`、
   `migrations/main/003_address_limit.sql`。
2. 安裝 PostgreSQL client（`psql`），提供 secret `PG_MAIN`。
3. `PGOPTIONS` 由部署設定 tenant schema 的 `search_path` 與 worker 的 RLS context。
   不能使用買家的 JWT／owner scope；worker 必須能存取該租戶所有待付款訂單。
   禁止關閉 RLS、使用跨租戶 schema 搜尋路徑或 SECURITY DEFINER。
4. Scheduler 每分鐘執行 `backend/jobs/expire-orders.sh`，檢查非零 exit code 並告警。
   同一租戶多個 worker 以 `FOR UPDATE SKIP LOCKED` 避免重複處理。
5. 部署前驗證 RLS：租戶 A 的 worker 能取消 A 的逾期訂單、不能讀寫 B 的任何資料。
   本 repo 測試只驗證租戶 schema 內的 SQL；尚未驗證 SDK 產生的 RLS policy。

## 失敗與並發

付款、手動取消及 worker 共用 order 列鎖，並使用條件 UPDATE。
付款只允許期限未到的 active reservation；worker 只處理仍 pending 的過期保留。
勝出者在同一交易中變更庫存與歷程，重跑不會二次回補。
資料不一致（缺少商品／規格／保留數）使整批回滾並讓 job 失敗，修正資料後重試。
保留期限用資料庫時間，不能相信瀏覽器傳入的時間。

此 job 可執行 SQL，但尚未部署 scheduler；SDK 基礎 schema／驗證仍阻塞 #66 的完整驗收。

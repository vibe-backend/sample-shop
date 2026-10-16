# login

以 email 與密碼登入，簽發 access token。此 method 具備簽發 token 的能力（capabilities: [sign-token]）。

## 輸入

- email、password。

## 做法

1. 以小寫 email 查詢 users，取得 id、password_hash、roles。
2. 用 verify-password 比對 password 與 password_hash；查無使用者或比對失敗，一律回 `INVALID_CREDENTIALS`。
3. 用 sign-jwt 簽發 access token：sub 為使用者 id，ttl 1 小時，issue-refresh 為 none（不發 refresh token）。
4. 回傳 access_token 與 expires_at（ISO 8601 UTC）。

## 錯誤

- INVALID_CREDENTIALS：帳號或密碼錯誤（不區分哪一項錯）。

此 method 不寫入使用者資料表。

# users

## Providers

帳號 API。lock 正文由標題 `## Providers` 開始，其後只接 `## Pipelines`、`## Defaults`。provider 名單只寫在這一節的 allowlist 鍵。

- allowlist: [main]
- default: main

## Pipelines

預設需要 JWT。註冊與登入在各自 feature 中明確設為公開。

### auth

- mode: jwt

## Defaults

預設逾時與 body 上限寫在這一節。

- timeout: 10s
- body: 64KB

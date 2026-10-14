# Sample Shop 後端（vibe-backend markdown）

本目錄以 vibe-backend SDK 的**自然語言 markdown source**（繁體中文）定義後端，依 spec v1.7 的目錄結構：

```text
backend/
├── providers/main.md            # PostgreSQL
├── models/                      # user、product、cart-item、order、order-item 與其 methods
├── api/
│   ├── users/v1/                # register、login、me
│   ├── catalog/v1/              # 商品列表／詳情（公開）、店員 CRUD
│   └── shop/v1/                 # 購物車、訂單（JWT，本人）
├── slugs.example.json           # 開發用 slug `main` → 租戶 `main0001`
└── CONTRACT.md                  # 前端串接契約（完整版）
```

## API 契約摘要

| 路由 | 驗證 | Request | Response |
| --- | --- | --- | --- |
| `POST /users/v1/{slug}/register` | 公開 | `email`, `password`, `display_name` | 201 `{access_token, expires_at}` |
| `POST /users/v1/{slug}/login` | 公開 | `email`, `password` | 200 `{access_token, expires_at}` |
| `GET /users/v1/me` | JWT | — | 200 `{id, email, display_name, roles}` |
| `GET /catalog/v1/{slug}/products` | 公開 | `q`, `category`, `min/max_price_cents`, `sort`, `order`, `cursor`, `limit` | 200 `{items, next_cursor}` |
| `GET /catalog/v1/{slug}/products/{id}` | 公開 | — | 200 `Product` |
| `GET /catalog/v1/{slug}/staff/products` | JWT `roles: [staff]` | `category`, `active`, `cursor`, `limit` | 200 `{items, next_cursor}` |
| `POST /catalog/v1/{slug}/products` | JWT `roles: [staff]` | `ProductInput` | 201 `Product` |
| `PUT /catalog/v1/{slug}/products/{id}` | JWT `roles: [staff]` | `If-Match` + 部分欄位 | 200 `Product` |
| `DELETE /catalog/v1/{slug}/products/{id}` | JWT `roles: [staff]` | — | 204 |
| `GET /shop/v1/cart-items` | JWT | — | 200 `{items, subtotal_cents}` |
| `POST /shop/v1/cart-items` | JWT | `product_id`, `quantity` | 200 `Cart`（同商品累加） |
| `PUT /shop/v1/cart-items/{id}` | JWT | `quantity` | 200 `Cart` |
| `DELETE /shop/v1/cart-items/{id}` | JWT | — | 200 `Cart` |
| `POST /shop/v1/orders` | JWT | `Idempotency-Key` | 201 `Order`，清空購物車 |
| `GET /shop/v1/orders` | JWT | `cursor`, `limit` | 200 `{items, next_cursor}` |
| `GET /shop/v1/orders/{id}` | JWT | — | 200 `Order` |

詳細型別、錯誤碼、與前端差異及 SDK 缺口見 [CONTRACT.md](CONTRACT.md)。

## 狀態

SDK 尚未發佈（v0.1.0 前）。目前自然語言編譯無法穩定產生可通過驗證的 lock（sdk #83、#37），因此 repo 只含 source，尚未提交 lock 與 manifest。登入／註冊另需 sdk PR #77。

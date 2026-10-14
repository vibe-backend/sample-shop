# Sample Shop 後端 API 契約（草案 v1）

> 狀態：草案，等前端與 Jack 確認。後端以 vibe-backend SDK（未發佈，依 spec v1.7；v1.8 草稿只在相容處參考）實作。
> 標記 **〔缺口〕** 的項目，表示目前 SDK／spec 無法表達或尚未實作，前端應先以替代方案或 mock 處理；已連結對應的 SDK issue。

## 1. 通用約定

| 項目 | 約定 |
| --- | --- |
| Base URL | 本機開發 `http://localhost:8080`；正式環境另行通知 |
| `{slug}` | 商店（租戶）識別碼。前端使用常數 `main`（`VITE_SHOP_SLUG`）。公開端點用它決定租戶 |
| 驗證 | `Authorization: Bearer <access_token>`（JWT，ES256，效期最長 1 小時） |
| 格式 | JSON，`Content-Type: application/json`；未宣告欄位一律 422 |
| 時間 | ISO 8601 UTC，例如 `2026-10-14T10:00:00Z` |
| 金額 | 整數 `*_cents`，搭配 `currency`（預設 `TWD`） |
| 數量 | `quantity` 為 1–99 的整數 |
| 錯誤格式 | `{ "error": { "code": "OUT_OF_STOCK", "message": "…", "request_id": "…" } }` |
| 401 | 一律帶 `WWW-Authenticate`；不區分帳號不存在或密碼錯誤 |
| 樂觀鎖 | 店員更新商品須帶 `If-Match: <ETag>`；缺少回 428，不符回 412 |
| CORS | 需允許 `https://vibe-backend.github.io` 與 `http://localhost:*` **〔缺口〕** SDK 尚無 CORS 設定（sdk #84），暫由前端 dev proxy 或閘道處理 |

## 2. 端點一覽

| # | 方法與路由 | 驗證 | Request | 成功回應 | 主要錯誤 |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST /users/v1/{slug}/register` | 公開（IP 每分鐘 10 次） | body `email`, `password`(8–72), `display_name`(1–50) | 201 `AuthToken` | 409 `EMAIL_TAKEN`、422 |
| 2 | `POST /users/v1/{slug}/login` | 公開（IP 每分鐘 10 次） | body `email`, `password` | 200 `AuthToken` | 401 `INVALID_CREDENTIALS` |
| 3 | `GET /users/v1/me` | JWT | — | 200 `Me` | 401 |
| 4 | `GET /catalog/v1/{slug}/products` | 公開（IP 每分鐘 600 次） | query `q`, `category`, `min_price_cents`, `max_price_cents`, `sort`(`price`\|`created_at`), `order`(`asc`\|`desc`), `cursor`, `limit`(1–100) | 200 `Page<Product>` | 422 |
| 5 | `GET /catalog/v1/{slug}/products/{id}` | 公開 | path `id`(uuid) | 200 `Product` | 404 `NOT_FOUND` |
| 6 | `GET /catalog/v1/{slug}/staff/products` | JWT，`roles: [staff]` | query `category`, `active`, `cursor`, `limit` | 200 `Page<Product>`（含下架商品） | 403 |
| 7 | `POST /catalog/v1/{slug}/products` | JWT，`roles: [staff]` | body `ProductInput` | 201 `Product` + `Location` | 409 `CONFLICT`（slug 重複）、422 |
| 8 | `PUT /catalog/v1/{slug}/products/{id}`（前端為 PATCH，見 §5） | JWT，`roles: [staff]` | `If-Match`；body 部分 `ProductInput` | 200 `Product` | 404、412、428、422 |
| 9 | `DELETE /catalog/v1/{slug}/products/{id}` | JWT，`roles: [staff]` | — | 204（軟刪除） | 404 |
| 10 | `GET /shop/v1/cart-items` | JWT（本人） | — | 200 `Cart` | 401 |
| 11 | `POST /shop/v1/cart-items` | JWT（本人） | body `product_id`, `quantity` | 200 `Cart`（同商品累加數量） | 404 `PRODUCT_NOT_FOUND`、409 `OUT_OF_STOCK`、422 `QUANTITY_LIMIT` |
| 12 | `PUT /shop/v1/cart-items/{id}`（前端為 PATCH，見 §5） | JWT（本人） | body `quantity` | 200 `Cart` | 404、422 |
| 13 | `DELETE /shop/v1/cart-items/{id}` | JWT（本人） | — | 200 `Cart` | 404 |
| 14 | `POST /shop/v1/orders` | JWT（本人） | header `Idempotency-Key`（建議必帶）；body `{}`（不含地址、付款欄位） | 201 `Order` + `Location`；成功後清空購物車 | 422 `CART_EMPTY`、409 `OUT_OF_STOCK`、409 `PRODUCT_UNAVAILABLE` |
| 15 | `GET /shop/v1/orders` | JWT（本人） | query `cursor`, `limit` | 200 `Page<OrderSummary>`（新到舊） | 401 |
| 16 | `GET /shop/v1/orders/{id}` | JWT（本人） | path `id` | 200 `Order` | 404（不存在或非本人） |

## 3. 資料型別

```ts
type AuthToken = { access_token: string; expires_at: string }; // 不發 refresh token
type Me = { id: string; email: string; display_name: string; roles: string[] };
type Product = {
  id: string; slug: string; name: string; description: string | null; category: string;
  price_cents: number; currency: string; image_urls: string[];
  stock: number; in_stock: boolean; active: boolean; created_at: string;
};
type ProductInput = Omit<Product, 'id' | 'in_stock' | 'created_at'>;
type Page<T> = { items: T[]; next_cursor: string | null };
type CartItem = {
  id: string; product_id: string; quantity: number;
  product: { name: string; image_url: string | null; unit_price_cents: number; currency: string; in_stock: boolean };
  line_total_cents: number;
};
type Cart = { items: CartItem[]; subtotal_cents: number };
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OrderItem = { product_id: string; product_name: string; unit_price_cents: number; quantity: number; line_total_cents: number };
type Order = { id: string; status: OrderStatus; items: OrderItem[]; total_cents: number; currency: string; created_at: string };
type OrderSummary = Omit<Order, 'items'>;
```

## 4. Token 與刷新策略

- Access token 效期最長 1 小時（spec 4A.1），`expires_at` 為到期時間。
- Spec 有 refresh token 輪換設計（`token-refresh` pipeline），但 SDK 尚未實作（sdk #26）。
- **目前做法（與前端 PR #3 一致）：** 登入／註冊只回 `{access_token, expires_at}`，不發 refresh token；到期或收到 401 時導回登入頁重新登入。
- 實作後新增 `POST /users/v1/{slug}/refresh`（body `refresh_token`，回 `AuthToken`），與 `POST /users/v1/logout`。

## 4a. 登入／註冊的實作依賴

- `user.login` 需要 `query`、`verify-password`、`sign-jwt`，`user.register` 需要 `hash-password`。sdk main 的 runtime 尚未能執行這些 op；**需要 sdk PR #77（runtime: executable auth method ops）合併後才能實際運作**。在此之前，端點 1–3 只能通過編譯／驗證，`serve` 無法登入，測試時以本機簽發的 JWT 代替。

## 5. 與前端現況的差異（需確認）

| 前端現況（`frontend/src/api/real.ts`） | 本契約 | 原因 |
| --- | --- | --- |
| `POST /users/v1/login`、`/users/v1/register`（無 slug） | `/users/v1/{slug}/login`、`/register` | spec：公開端點必須由路徑 slug 決定租戶 |
| `PATCH /shop/v1/cart-items/{id}`、`PATCH …/products/{id}` | **差異：** 後端改用 `PUT`（欄位可部分提供），前端需改方法 | spec v1.7 只允許 GET/POST/PUT/DELETE **〔缺口〕** |
| 店員列表與公開列表共用 `/products` | 店員改用 `/catalog/v1/{slug}/staff/products` | 公開端點不可帶驗證；同一路由不能同時公開又要求 staff |
| `DELETE` 購物車回傳 `Cart` | 相同（200 `Cart`） | — |

## 6. 缺口與 SDK issue

| 需求 | 狀態 | SDK issue |
| --- | --- | --- |
| 購物車品項嵌入商品摘要（join／expand） | 以 method SQL 關聯 products 表撰寫；spec 10.8 禁止 query 其他物件的表，驗證可能不通過 **〔缺口〕** | #21 |
| 同商品累加數量 | 以 `cart-item.add` method 先查再更新／新增 | — |
| 下單需同一 transaction 寫入 order、order-item、product、cart-item | method 只能經各自 method 寫入，跨物件交易語意未定義 **〔缺口〕** | 待確認 |
| Idempotency-Key | 以 `orders.idempotency_key` 欄位 + method 先查重模擬；平台層未支援 **〔缺口〕** | #85 |
| PATCH | 不支援 **〔缺口〕** | #86 |
| Cursor 分頁、價格區間篩選 | 內建 CRUD 只有 offset 分頁；以自訂 method 撰寫 **〔缺口〕** | #87 |
| CORS | 不支援 **〔缺口〕** | #84 |
| 商品關鍵字搜尋 `q` | 以 method SQL `ILIKE` 撰寫 | — |
| Refresh token | 未實作，暫用重新登入 | #26 |

## 7. 已採用的前端假設（sample-shop PR #3）

- 訂單狀態：`pending`、`paid`、`shipped`、`delivered`、`cancelled`。
- 排序：`sort=price|created_at` 搭配 `order=asc|desc`。
- 購物車 POST／更新／DELETE 皆回傳整個 `Cart`（更新方法為 PUT，見 §5）。
- 登入／註冊回 `{access_token, expires_at}`，不發 refresh token。
- 商品有 `category`；商品與訂單皆有 `currency`。
- 結帳不含地址與付款欄位。

## 8. 編譯狀態

- 自然語言 source 以 sdk main（`71b4cc1`）+ `gpt-5.5` 編譯 9 次，全部失敗（每次不同檔案出現 LLM 格式錯誤；整批不寫入，sdk #83）。
- 以子集（product + 兩個 catalog API）編譯可產生 lock，但 `vibe validate` 不通過（LLM 自創 key、欄位表欄位錯位），見 sdk #37。
- 因此本契約目前**尚未有可執行的後端**；前端請先以 mock（PR #3）開發。

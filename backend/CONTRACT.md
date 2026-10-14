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
| 5 | `GET /catalog/v1/{slug}/products/{id}` | 公開 | path `id`(uuid) | 200 `Product`（含 `options`、`variants`） | 404 `NOT_FOUND` |
| 6 | `GET /catalog/v1/{slug}/staff/products` | JWT，`roles: [staff]` | query `category`, `active`, `cursor`, `limit` | 200 `Page<Product>`（含下架商品） | 403 |
| 7 | `POST /catalog/v1/{slug}/products` | JWT，`roles: [staff]` | body `ProductInput` | 201 `Product` + `Location` | 409 `CONFLICT`（slug 重複）、422 |
| 8 | `PUT /catalog/v1/{slug}/products/{id}` | JWT，`roles: [staff]` | `If-Match`；body 部分 `ProductInput` | 200 `Product` | 404、412、428、422 |
| 9 | `DELETE /catalog/v1/{slug}/products/{id}` | JWT，`roles: [staff]` | — | 204（軟刪除） | 404 |
| 10 | `GET /shop/v1/cart-items` | JWT（本人） | — | 200 `Cart` | 401 |
| 11 | `POST /shop/v1/cart-items` | JWT（本人） | body `product_id`, `sku_id`（商品有規格時必填）, `quantity` | 200 `Cart`（`product_id` 與 `sku_id` 都相同才累加） | 404 `PRODUCT_NOT_FOUND`、409 `PRODUCT_UNAVAILABLE`（規格全部停用）、404 `SKU_NOT_FOUND`、422 `SKU_REQUIRED`、409 `OUT_OF_STOCK`（依規格）、422 `QUANTITY_LIMIT` |
| 12 | `PUT /shop/v1/cart-items/{id}` | JWT（本人） | body `quantity` | 200 `Cart` | 404、404 `SKU_NOT_FOUND`、409 `OUT_OF_STOCK`（依規格）、422 |
| 13 | `DELETE /shop/v1/cart-items/{id}` | JWT（本人） | — | 200 `Cart` | 404 |
| 14 | `POST /shop/v1/orders` | JWT（本人） | header `Idempotency-Key`（**必填**，見 §10）；body `address_id`（**必填**，見 §12；不含付款欄位） | 201 `Order`（含 `shipping_address`）+ `Location`；成功後清空購物車 | 400 `IDEMPOTENCY_KEY_REQUIRED`、409 `IDEMPOTENCY_KEY_REUSED`、422 `ADDRESS_REQUIRED`、404 `ADDRESS_NOT_FOUND`、422 `CART_EMPTY`、409 `OUT_OF_STOCK`、409 `PRODUCT_UNAVAILABLE`（§11）、504 `TX_TIMEOUT`、503 `TX_CONFLICT` |
| 15 | `GET /shop/v1/orders` | JWT（本人） | query `cursor`, `limit` | 200 `Page<Order>`（新到舊，含 items） | 401 |
| 16 | `GET /shop/v1/orders/{id}` | JWT（本人） | path `id` | 200 `Order` | 404（不存在或非本人） |
| 17 | `GET /shop/v1/addresses` | JWT（本人） | — | 200 `Address[]`（預設排最前，不分頁） | 401 |
| 18 | `POST /shop/v1/addresses` | JWT（本人） | body `AddressInput` | 201 `Address` + `Location` | 422 `VALIDATION_FAILED`、422 `ADDRESS_LIMIT` |
| 19 | `POST /shop/v1/orders/{id}/payments` | JWT（本人） | header `Idempotency-Key`（**必填**，§10）；body `PaymentInput` | 200 `Order`（`status: 'paid'`、`payment_method`、`paid_at`） | 400 `IDEMPOTENCY_KEY_REQUIRED`、402 `PAYMENT_DECLINED`、404 `NOT_FOUND`、409 `ORDER_NOT_PAYABLE`、409 `IDEMPOTENCY_KEY_REUSED`、422 `VALIDATION_FAILED`、504、503（§13） |
| 20 | `POST /shop/v1/orders/{id}/cancel` | JWT（本人） | body `{}`；**不需** `Idempotency-Key`（§10） | 200 `Order`（`status: 'cancelled'`；回補庫存，已付款則模擬退款，§14） | 404 `NOT_FOUND`（不存在或非本人）、409 `INVALID_TRANSITION`、504、503 |
| 21 | `POST /shop/v1/orders/{id}/confirm-delivery` | JWT（本人） | body `{}`；**不需** `Idempotency-Key` | 200 `Order`（`status: 'delivered'`） | 404 `NOT_FOUND`、409 `INVALID_TRANSITION`、504、503 |
| 22 | `GET /shop/v1/staff/orders` | JWT，`roles: [staff]` | query `status`(`OrderStatus`), `cursor`, `limit`(1–100) | 200 `Page<StaffOrder>`（所有使用者，新到舊） | 403 `FORBIDDEN`、422 `VALIDATION_FAILED` |
| 23 | `PUT /shop/v1/staff/orders/{id}/status` | JWT，`roles: [staff]` | body `{ status: 'shipped' \| 'cancelled' }`；**不需** `Idempotency-Key` | 200 `StaffOrder` | 403 `FORBIDDEN`、404 `NOT_FOUND`、409 `INVALID_TRANSITION`、422 `VALIDATION_FAILED`、504、503 |
| — | `PUT`／`DELETE /shop/v1/addresses/{id}`、`POST /shop/v1/addresses/{id}/default` | JWT（本人） | — | 規劃中（#44），v1 未實作 | — |

## 3. 資料型別

```ts
// 與前端 sample-shop PR #60 frontend/src/api/types.ts 一致；地址相關型別與 sold_count 依 PR #64
type AuthToken = { access_token: string; expires_at: string }; // 不發 refresh token
type Me = { id: string; email: string; display_name: string; roles: string[] };

type SkuOptions = Record<string, string>;            // 規格名稱 → 值，例如 { 顏色: '黑色', 尺寸: '大' }
type ProductOption = { name: string; values: string[] };
type ProductVariant = {
  id: string;                 // sku_id
  options: SkuOptions;
  price_cents: number;
  stock: number;
  in_stock: boolean;
  image_url?: string | null;
};
type Product = {
  id: string; slug: string; name: string; description: string; category: string;
  price_cents: number;        // 有規格時 = active 規格中的最低價
  currency: string; image_urls: string[];
  stock: number;              // 有規格時 = active 規格 stock 總和
  in_stock: boolean; active: boolean; created_at: string;
  sold_count?: number;        // 後端一律回傳；下單時累加（§12）
  options?: ProductOption[];  // 缺少或空陣列 = 沒有規格（後端一律回傳陣列）
  variants?: ProductVariant[];
};
type ProductInput = Omit<Product, 'id' | 'in_stock' | 'created_at' | 'sold_count'>;
type Page<T> = { items: T[]; next_cursor: string | null };

type ProductSummary = {
  id: string; slug: string; name: string;
  price_cents: number;        // 有規格時為該規格價格
  currency: string;
  image_url: string | null;   // 有規格時優先用規格圖片
  in_stock: boolean;          // 有規格時依該規格庫存
};
type SkuRef = { id: string; options: SkuOptions };
type CartItem = { id: string; product: ProductSummary; sku?: SkuRef | null; quantity: number; line_total_cents: number };
type Cart = { items: CartItem[]; subtotal_cents: number };

type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OrderItem = {
  product_id: string;
  sku_id?: string | null;
  sku_options?: SkuOptions | null; // 下單當時的規格快照
  name: string;                    // 下單當時的商品名稱
  unit_price_cents: number; quantity: number; line_total_cents: number;
};
type Address = {
  id: string; recipient: string;
  phone: string;              // 8 位香港號碼，已正規化（無 +852／空白）
  region: string;             // 香港島 | 九龍 | 新界 | 離島
  line1: string;              // 詳細地址
  is_default: boolean; created_at: string;
};
type AddressInput = { recipient: string; phone: string; region: string; line1: string; is_default?: boolean };
type AddressSnapshot = Pick<Address, 'recipient' | 'phone' | 'region' | 'line1'>;
type CreateOrderInput = { address_id: string };
type PaymentMethod = 'mock_card' | 'mock_alipay';
type PaymentInput = { method: PaymentMethod; simulate: 'success' | 'failure' };
type OrderStatusEvent = { status: OrderStatus; at: string }; // §14，ISO 8601 UTC
type Order = { id: string; status: OrderStatus; payment_method?: PaymentMethod | null; paid_at?: string | null; status_history?: OrderStatusEvent[]; shipping_address?: AddressSnapshot | null; items: OrderItem[]; total_cents: number; currency: string; created_at: string };
// §14：後端一律回傳 status_history（由舊到新，至少一筆 pending）
type StaffOrder = Order & { buyer: { id: string; display_name: string; email: string } };
type StaffOrderStatusInput = { status: 'shipped' | 'cancelled' };
```

## 4. Token 與刷新策略

- Access token 效期最長 1 小時（spec 4A.1），`expires_at` 為到期時間。
- Spec 有 refresh token 輪換設計（`token-refresh` pipeline），但 SDK 尚未實作（sdk #26）。
- **目前做法（與前端 PR #3 一致）：** 登入／註冊只回 `{access_token, expires_at}`，不發 refresh token；到期或收到 401 時導回登入頁重新登入。
- 實作後新增 `POST /users/v1/{slug}/refresh`（body `refresh_token`，回 `AuthToken`），與 `POST /users/v1/logout`。

## 4b. 交易與並行（已核准的跨 model 寫入規則）

- 每個請求是一個 runtime 交易；SQL 中不得出現 `BEGIN`／`COMMIT`／`SAVEPOINT`。
- 隔離等級 READ COMMITTED。扣庫存使用 `UPDATE … SET stock = stock - $qty WHERE id = $id AND stock >= $qty` 並檢查影響列數；不足回 409 `OUT_OF_STOCK`，整筆回滾。
- 不跨請求、不跨資料庫、不使用分散式交易；寫入依固定順序並在 `SET LOCAL ROLE` 下執行（下單：確認地址 → 扣庫存並累加 sold_count → 建立訂單（含 shipping_address 快照）→ 品項快照 → 清空購物車；扣庫存依 id 排序以降低死結機率）。
- 逾時：statement 5s、交易 10s、idle_in_transaction 5s；逾時回滾並回 504 `TX_TIMEOUT`。
- 死結（40P01）或序列化失敗（40001）：回 503 `TX_CONFLICT`，body 帶 `retryable: true`，header `Retry-After: 1`。非冪等寫入不自動重試；前端重試下單時**必須**沿用同一個 `Idempotency-Key`（§10）。

## 4c. 錯誤碼一覽

| 狀態碼 | code | 端點 | 說明 |
| --- | --- | --- | --- |
| 401 | `INVALID_CREDENTIALS` | login | 帳號或密碼錯誤 |
| 404 | `NOT_FOUND` | 多數 | 資源不存在或非本人 |
| 404 | `PRODUCT_NOT_FOUND` | 加入購物車 | 商品不存在或已下架 |
| 404 | `SKU_NOT_FOUND` | 加入／修改購物車 | 規格不存在、已停用或不屬於該商品 |
| 409 | `EMAIL_TAKEN` | register | email 已被使用 |
| 409 | `CONFLICT` | 新增商品 | slug 重複 |
| 409 | `OUT_OF_STOCK` | 購物車、下單 | 庫存不足（有規格時依規格） |
| 409 | `PRODUCT_UNAVAILABLE` | 加入購物車、下單 | 商品有規格但全部停用；或下單時購物車中商品／規格已下架。下單時 `details.cart_item_ids` 列出受影響品項（§11） |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | 下單 | 未帶 `Idempotency-Key`（§10） |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 下單 | 同一 key 但 body 不同（§10） |
| 402 | `PAYMENT_DECLINED` | 訂單付款 | 模擬付款失敗；訂單維持 `pending`，key 不保留，可重試（§13） |
| 409 | `ORDER_NOT_PAYABLE` | 訂單付款 | 訂單已付款或已取消，或並發付款已先成功（§13） |
| 409 | `INVALID_TRANSITION` | 取消、確認收貨、店員變更狀態 | 目前狀態不允許此轉換（含重複操作已是終止狀態的訂單），見 §14 |
| 403 | `FORBIDDEN` | 店員端點 | 非 staff 角色 |
| 404 | `ADDRESS_NOT_FOUND` | 下單 | `address_id` 不存在或屬於他人（§12） |
| 412 / 428 | — | 更新商品 | `If-Match` 不符／缺少 |
| 422 | `VALIDATION_FAILED` | 全部 | 欄位驗證失敗或未宣告欄位 |
| 422 | `SKU_REQUIRED` | 加入購物車 | 商品有規格但未提供 `sku_id` |
| 422 | `QUANTITY_LIMIT` | 加入購物車 | 累加後超過 99 |
| 422 | `ADDRESS_LIMIT` | 新增地址 | 已有 20 個地址 |
| 422 | `ADDRESS_REQUIRED` | 下單 | body 缺少 `address_id` |
| 422 | `CART_EMPTY` | 下單 | 購物車為空 |
| 503 | `TX_CONFLICT` | 寫入端點 | 死結或序列化失敗；`retryable: true`、`Retry-After: 1` |
| 504 | `TX_TIMEOUT` | 寫入端點 | 交易逾時，已回滾 |

`TX_CONFLICT` 的 body：`{ "error": { "code": "TX_CONFLICT", "message": "…", "request_id": "…", "retryable": true } }`（`retryable` 為此錯誤額外欄位；SDK 目前的錯誤格式沒有此欄位 **〔缺口〕**）。

## 4a. 登入／註冊的實作依賴

- `user.login` 需要 `query`、`verify-password`、`sign-jwt`，`user.register` 需要 `hash-password`。sdk main 的 runtime 尚未能執行這些 op；**需要 sdk PR #77（runtime: executable auth method ops）合併後才能實際運作**。在此之前，端點 1–3 只能通過編譯／驗證，`serve` 無法登入，測試時以本機簽發的 JWT 代替。

## 5. 與前端的差異

前端 PR #60（`feat/sku-variants`）已改為：登入／註冊帶 `{slug}`、更新購物車與商品用 `PUT`、店員列表用 `/catalog/v1/{slug}/staff/products`，先前的差異已消除。

| 項目 | 前端 types.ts | 本契約 | 說明 |
| --- | --- | --- | --- |
| `Product.options` / `variants` | 選填 | 後端一律回傳（沒有規格時為空陣列） | 前端以「缺少或空」判斷皆相容 |
| `Product.description` | `string` | 可能為空字串 | source 中為選填；後端以空字串回傳，不回 null |
| `ProductInput` 含 `variants` | 由 `Omit<Product,…>` 推得 | **v1 忽略 `variants`**（傳入不報錯也不寫入）；只處理 `options` | 店員規格管理為後續工作（sample-shop issue 見 §9） |
| 錯誤 body `retryable` | 未定義 | 只在 `TX_CONFLICT` 出現 | 需前端處理 503 重試 |

## 6. 缺口與 SDK issue

| 需求 | 狀態 | SDK issue |
| --- | --- | --- |
| 購物車品項嵌入商品摘要（join／expand） | 以 method SQL 關聯 products 表撰寫；spec 10.8 禁止 query 其他物件的表，驗證可能不通過 **〔缺口〕** | #21 |
| 同商品累加數量 | 以 `cart-item.add` method 先查再更新／新增 | — |
| 下單需同一交易寫入 product／product-variant、order、order-item、cart-item | 依已核准的跨 model 寫入規則（§4b）撰寫；SDK runtime 尚未實作這些交易語意 | — |
| Idempotency-Key | 以 `orders.idempotency_key` 欄位 + method 先查重模擬；平台層未支援 **〔缺口〕** | #85 |
| PATCH | 不支援；前端已改用 PUT | #86 |
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

## 9. 規格（SKU）規則（前端 #17／PR #60）

- 商品有 active 規格時：`price_cents` = active 規格最低價（**庫存為 0 的 active 規格仍計入最低價**），`stock` = active 規格庫存總和，`in_stock` = `stock > 0`。inactive 或已刪除的規格不出現在 `variants`，也不參與計算。
- 商品有 `options` 但規格**全部 inactive**：視為不可購買。`variants` 為空陣列、`stock` = 0、`in_stock` = false；`price_cents` 維持商品本身的基本價格（僅供顯示，不可據此購買）。加入購物車回 409 `PRODUCT_UNAVAILABLE`。
- 商品沒有規格時：`options`、`variants` 回傳空陣列。
- 加入購物車：有規格必帶 `sku_id`（否則 422 `SKU_REQUIRED`）；未知或屬於其他商品的 sku 回 404 `SKU_NOT_FOUND`；庫存依規格檢查。
- 購物車品項只有 `product_id` 與 `sku_id` 都相同時才合併數量。
- 下單時快照 `sku_id`、`sku_options`、`name`、`unit_price_cents`，並扣減該規格庫存。
- v1 的 `ProductInput.variants` 會被忽略；店員規格管理（新增／修改／停用 variant）為後續工作，見 SAMPLE_SHOP_ISSUE。

## 10. 冪等性（Idempotency-Key）

適用：`POST /shop/v1/orders` 與 `POST /shop/v1/orders/{id}/payments`（付款的差異見 §13）。

**不適用（已決定）：** `POST /shop/v1/orders/{id}/cancel`、`POST /shop/v1/orders/{id}/confirm-delivery`、`PUT /shop/v1/staff/orders/{id}/status` **不需要** `Idempotency-Key`（帶了也忽略）。這些是狀態轉換，重送時依目前狀態判斷：取消後 `cancelled` 為終止狀態，重複取消回 409 `INVALID_TRANSITION`；確認收貨、店員出貨／取消重送同樣回 409 `INVALID_TRANSITION`。前端在逾時或網路錯誤後重試時收到 409 `INVALID_TRANSITION`，應重新取得訂單（`GET /shop/v1/orders/{id}`）確認是否已成功，不應視為失敗。

- `Idempotency-Key` header **必填**（1–64 字，建議 UUID v4）；缺少回 400 `IDEMPOTENCY_KEY_REQUIRED`。
- 範圍：同一使用者（JWT `sub`）＋同一路由。
- 同一 key、同一 body：回傳第一次建立的訂單（相同狀態碼 201 與內容），不重複扣庫存、不重複清空購物車。
- 同一 key、不同 body：回 409 `IDEMPOTENCY_KEY_REUSED`。比較依據為 body（`{ address_id }`）的正規化 JSON 雜湊；同一 key 但 `address_id` 不同即回 409。
- 第一次請求失敗（4xx、`TX_TIMEOUT`、`TX_CONFLICT`）時不保留 key，可用同一 key 重試。
- 收到 503 `TX_CONFLICT`（`retryable: true`、`Retry-After: 1`）或網路錯誤時，前端等待後**以同一個 key** 重試；使用者重新按下「下單」才產生新 key。
- 實作：SDK 平台層尚未支援（sdk #85），v1 以 `orders.idempotency_key` 與 method 內先查後寫模擬；並發的同 key 請求在 SDK 支援前無法完全保證只建立一筆 **〔缺口〕**。

## 11. 下單時 PRODUCT_UNAVAILABLE 的錯誤細節

下單時購物車中有商品或規格已下架、刪除或規格全部停用時回 409：

```json
{ "error": { "code": "PRODUCT_UNAVAILABLE", "message": "部分商品已無法購買", "request_id": "…",
             "details": { "cart_item_ids": ["…", "…"] } } }
```

- `details.cart_item_ids` 列出所有受影響的購物車品項 id，前端可標示或移除後再下單。
- SDK 目前的錯誤格式只有 `code`、`message`、`request_id`，**無法輸出 `details`** **〔缺口〕**。在 SDK 支援前，前端遇到此錯誤應重新取得購物車，以 `product.in_stock` 為 false 或商品已不存在的品項判斷。

## 12. 收貨地址（前端 #29，sample-shop PR #64）

- model `address`：每位使用者各自擁有（owner-key `user_id`），欄位 `id`、`recipient`、`phone`、`region`、`line1`、`is_default`、`created_at`；每人最多 20 個。
- 驗證（與 PR #64 `lib/address.ts` 相同）：`recipient` 1–50 字；`phone` 移除空白、連字號與開頭 `+852`／`852` 後須為 `[2-9]` 開頭的 8 位數字，並以正規化後的值儲存；`region` 為 香港島／九龍／新界／離島；`line1` 5–200 字。不通過回 422 `VALIDATION_FAILED`。
- `GET /shop/v1/addresses`：回傳 `Address[]`（非 `Page`），預設地址排最前，其餘依 `created_at` 由新到舊。
- `POST /shop/v1/addresses`：201。使用者的第一個地址自動成為預設；`is_default: true` 時在同一交易中先清除舊的預設。達 20 個回 422 `ADDRESS_LIMIT`。
- 下單：body `address_id` 必填（缺少 422 `ADDRESS_REQUIRED`；不存在或屬於他人 404 `ADDRESS_NOT_FOUND`）。`order.place` 在同一交易中把 `recipient`／`phone`／`region`／`line1` 快照寫入 `orders.shipping_address`，之後修改地址簿不影響訂單。`address_id` 計入冪等 body 雜湊（§10）。
- `Product.sold_count`：`order.place` 扣庫存時同時累加（有規格時加在所屬商品）；不可由 `ProductInput` 提供。
- 規劃中（#44，v1 未實作）：`PUT /shop/v1/addresses/{id}`（修改，回 200 `Address`）、`DELETE /shop/v1/addresses/{id}`（軟刪除，回 204；刪除預設地址時由最新的地址遞補）、`POST /shop/v1/addresses/{id}/default`（設為預設，回 200 `Address`）。
- 與 PR #64 `types.ts` 的差異：
  - 需求原寫 `address_line`，此處依 `types.ts` 採用 `line1`。
  - `CreateOrderInput.address_id` 在 `types.ts` 為選填（`address_id?`），後端視為必填（缺少回 422）。
  - `Order.shipping_address` 在 `types.ts` 可為 null／缺少；後端新訂單一律有值，只有加入地址前的舊訂單為 null。
  - 地址驗證錯誤碼已與其他端點統一為 `VALIDATION_FAILED`（已與前端確認）。

## 13. 模擬付款（前端 #30，sample-shop PR #65）

- `POST /shop/v1/orders/{id}/payments`（JWT，只限本人訂單）。body `PaymentInput`：`method` 為 `mock_card`／`mock_alipay`，`simulate` 為 `success`／`failure`（示範用，不涉及真實金流）。
- 成功：200，回傳整張 `Order`，`status: 'paid'`，並帶 `payment_method` 與 `paid_at`（ISO 8601 UTC）。新訂單的 `payment_method`、`paid_at` 為 `null`。
- 失敗（`simulate: 'failure'`）：402 `PAYMENT_DECLINED`；不寫入任何資料，訂單維持 `pending`，key 不保留，可用同一 key 重試。
- 其他錯誤：400 `IDEMPOTENCY_KEY_REQUIRED`；404 `NOT_FOUND`（不存在或屬於他人）；409 `ORDER_NOT_PAYABLE`（已付款或已取消）；422 `VALIDATION_FAILED`；504 `TX_TIMEOUT`；503 `TX_CONFLICT`。
- 冪等（套用 §10）：範圍為同一使用者＋付款路由。只有成功的付款會保留 key（model `payment-attempt`：`user_id`＋`idempotency_key` 唯一、`order_id` 唯一、`request_hash`、`method`）。同一 key 且同一訂單、同一 body 重送時回 200 與該訂單；同一 key 但訂單或 body 不同回 409 `IDEMPOTENCY_KEY_REUSED`。
- 檢查順序：訂單存在 → 重送判斷 → 欄位驗證 → `status` 必須為 `pending` → 模擬結果。
- 並發：狀態更新使用 `UPDATE orders SET status='paid', payment_method=…, paid_at=now() WHERE id=… AND user_id=… AND status='pending'` 並檢查影響列數；為 0 回 409 `ORDER_NOT_PAYABLE`，因此兩筆並發付款只有一筆成功。更新訂單與新增 `payment_attempts` 在同一交易中完成。
- 庫存（已決定）：v1 維持在下單時扣庫存（§4b）。
- 規劃中／未來工作（v1 未實作）：
  - 付款前的庫存保留（下單時只保留、付款成功才扣）。
  - 逾時未付款訂單自動取消並回補庫存。
  - 追蹤 issue：sample-shop #66。
- 與 PR #65 `types.ts`／mock 的差異：
  - mock 只驗證 `method`，不驗證 `simulate`；後端兩者都驗證，不合法回 422。
  - mock 以同一 key 重送時不比較 body，也不回 `IDEMPOTENCY_KEY_REUSED`；後端依 §10 比較 body 雜湊與訂單 id，不同則回 409。
  - `types.ts` 中 `payment_method`、`paid_at` 為選填；後端一律回傳（未付款時為 `null`）。

## 14. 訂單狀態流程（前端 #34，sample-shop PR #68）

### 狀態轉換表

| 目前狀態 | 動作 | 端點 | 執行者 | 新狀態 | 副作用 |
| --- | --- | --- | --- | --- | --- |
| （無） | 下單 | `POST /shop/v1/orders` | 買家 | `pending` | 扣庫存、累加 sold_count（§4b） |
| `pending` | 付款 | `POST /shop/v1/orders/{id}/payments` | 買家 | `paid` | 新增 payment_attempt（§13） |
| `pending` | 取消 | `POST …/orders/{id}/cancel` 或 `PUT …/staff/orders/{id}/status` | 買家（本人）或店員 | `cancelled` | 回補庫存、減 sold_count |
| `paid` | 取消 | 同上 | 買家（本人）或店員 | `cancelled` | 回補庫存、減 sold_count、**模擬退款** |
| `paid` | 出貨 | `PUT …/staff/orders/{id}/status`（`shipped`） | 店員 | `shipped` | — |
| `shipped` | 確認收貨 | `POST …/orders/{id}/confirm-delivery` | 買家（本人） | `delivered` | — |

- 表中以外的轉換一律回 409 `INVALID_TRANSITION`（例如 `shipped` 取消、`pending` 出貨、`paid` 確認收貨、重複取消）。`delivered`、`cancelled` 為終止狀態。
- 檢查順序：驗證（403／422）→ 訂單存在且可存取（404）→ 狀態轉換（409）。買家操作非本人訂單回 404 `NOT_FOUND`（不透露存在與否）。
- 並發：狀態更新皆使用 `UPDATE orders SET status = … WHERE id = … AND status = <原狀態>` 並檢查影響列數；為 0 回 409 `INVALID_TRANSITION`，因此並發的付款／取消／出貨只有一筆成功。

### 取消（買家 #20／店員 #23）

- 買家只能取消本人且狀態為 `pending` 或 `paid` 的訂單；店員可取消任何人 `pending` 或 `paid` 的訂單。兩者共用 `order.cancel`。
- 同一交易（§4b：每個請求一個交易、固定寫入順序、`SET LOCAL ROLE`）依序：鎖定並更新訂單狀態 → 回補庫存（有規格回補 `product_variants.stock`，否則 `products.stock`；依 sku_id／product_id 由小到大，與下單相同順序）並將所屬商品 `sold_count` 減去數量 → 已付款時標記退款 → 新增狀態歷程。任一步失敗整筆回滾。
- 已停用或軟刪除的商品／規格仍回補庫存。
- **模擬退款：** 取消 `paid` 訂單時，該訂單最新一筆成功的 `payment_attempt` 寫入 `refunded_at`（目前每張訂單最多一筆成功付款）。**這只是示範用的紀錄，不呼叫任何金流、沒有任何真實款項移動。** `Order.payment_method` 與 `paid_at` 保留原值；v1 的 `Order` 不輸出退款欄位。

### 店員訂單（#22／#23）

- `GET /shop/v1/staff/orders`：沿用 `Page<T>`（`items`、`next_cursor`）與 cursor 分頁，依 `created_at`、`id` 由新到舊；`status` 選填篩選。每筆為 `StaffOrder`（`Order` + `buyer: { id, display_name, email }`）。非 staff 回 403。
- `PUT /shop/v1/staff/orders/{id}/status`：body 只接受 `{ status: 'shipped' | 'cancelled' }`；其他值（包括 `paid`、`delivered`、`pending`）、缺少或多餘欄位回 422 `VALIDATION_FAILED`。`shipped` 只能由 `paid`；`cancelled` 與買家取消相同（回補庫存＋模擬退款）。回 200 `StaffOrder`。

### 狀態歷程 `status_history`

- 新增 model `order-status-event`（`order_status_events` 表：`order_id`、`user_id`（買家）、`status`、`at`、`actor`）。每次轉換（建立 `pending`、`paid`、`cancelled`、`shipped`、`delivered`）在同一交易中新增一筆；不可修改。
- `Order.status_history`：`{ status, at }[]`，由舊到新，`at` 為 ISO 8601 UTC。第一筆一定是 `pending`（等於 `created_at`），最後一筆的 `status` 等於 `Order.status`。`actor` 僅供稽核，不輸出。
- 所有回傳 `Order` 的端點（#14–#16、#19–#23）皆含 `status_history`。加入此功能前的舊訂單由遷移補一筆 `pending`（`at` = `created_at`），已付款者另補 `paid`（`at` = `paid_at`）。

### 與 PR #68 `types.ts` 的差異

- 路徑：需求原寫 `/shop/v1/{slug}/orders/...`、`/shop/v1/{slug}/staff/orders`；依本契約 shop 端點慣例（#10–#19 不帶 `{slug}`）與 PR #68 `real.ts`，採用 `/shop/v1/orders/{id}/cancel`、`/shop/v1/orders/{id}/confirm-delivery`、`/shop/v1/staff/orders`、`/shop/v1/staff/orders/{id}/status`。
- `Order.status_history` 在 `types.ts` 為選填；後端一律回傳。
- 歷程元素型別名稱依 `types.ts` 為 `OrderStatusEvent`（欄位 `status`、`at`）；model 因此命名為 `order-status-event`。
- 店員變更狀態回傳型別依 `types.ts` 為 `StaffOrder`（含 `buyer`），不是 `Order`。
- `types.ts` 的 `listStaffOrders` 參數只有 `status`、`cursor`；後端另接受選填 `limit`（與其他列表一致）。


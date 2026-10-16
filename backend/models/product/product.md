# product

## Table

商品目錄，屬於整個商店（租戶）共享的資料，沒有列擁有者。lock 正文由標題 `## Table` 開始，其後只接 `## Fields`、`## CRUD`、`## Policies`。表名只寫在這一節的 table 鍵。

- provider: main
- table: products

## Fields

Fields 用表格，欄位是 name、type、rules、system。type 只可填 uuid、string、string[]、integer、number、boolean、timestamp、password、json、bytes，照下表抄寫。

| name | type | rules | system |
| --- | --- | --- | --- |
| slug | string | required, unique, max: 80 | no |
| name | string | required, max: 120 | no |
| description | string | max: 4000, default: "" | no |
| category | string | required, max: 40 | no |
| price_cents | integer | required, min: 0 | no |
| currency | string | required, min: 3, max: 3, default: TWD | no |
| image_urls | string[] | nullable, max-items: 10 | no |
| stock | integer | required, min: 0, default: 0 | no |
| active | boolean | required, default: true | no |
| sold_count | integer | required, min: 0, default: 0 | no |
| options | json | nullable | no |

- slug 只允許 a-z、0-9 與連字號。
- description 選填，預設空字串，不回傳 null。
- currency 固定 3 個大寫字母，例如 TWD。
- image_urls 選填，最多 10 個網址。type 是 string[]。
- sold_count 只由 order.place 累加，建立或更新商品時不可提供。
- options 選填，type 是 json。內容是規格群組的序列，最多 3 組。每一組有 name（string，最長 20）與 values（1 至 20 個 string，每個最長 20）。空序列或省略代表此商品沒有規格。例如一組的 name 是顏色，values 是黑色與米白。

## CRUD

- create、get、update（以 If-Match 樂觀鎖）、delete（軟刪除）。
- list：每頁預設 20 筆、最多 100 筆；可依 created_at、price_cents 排序；可依 category、active 篩選。

對應的 CRUD 表：

| method | options |
| --- | --- |
| create | - |
| get | - |
| list | page-size: 20, max-page-size: 100, sort: [created_at, price_cents], filter: [category, active] |
| update | optimistic-lock: if-match |
| delete | soft: true |

## Policies

啟用並強制 RLS。租戶欄位由平台自動加入，不需宣告。

## 規格與彙總

- 規格（SKU）存在 product-variant model。
- 商品有 active 規格時，對外輸出的 price_cents 為「active 的規格中最低的 price_cents」（庫存為 0 的 active 規格也計入），stock 為「active 的規格 stock 總和」，in_stock 為 stock > 0。
- 商品有 options 但規格全部 inactive 時，視為不可購買：variants 為空陣列、stock 為 0、in_stock 為 false，price_cents 輸出商品本身的基本價格（僅供顯示）。
- 商品沒有 options 時，沿用商品本身的 price_cents 與 stock。

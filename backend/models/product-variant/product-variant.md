# product-variant

## Table

商品規格（SKU），屬於整個商店（租戶）共享的資料，沒有列擁有者。lock 正文由標題 `## Table` 開始，其後只接 `## Fields`、`## CRUD`、`## Policies`。表名只寫在這一節的 table 鍵。

- provider: main
- table: product_variants

## Fields

Fields 用表格，欄位是 name、type、rules、system。type 只可填 uuid、string、string[]、integer、number、boolean、timestamp、password、json、bytes，照下表抄寫。

| name | type | rules | system |
| --- | --- | --- | --- |
| product_id | uuid | required | no |
| options | json | required | no |
| price_cents | integer | required, min: 0 | no |
| stock | integer | required, min: 0, default: 0 | no |
| image_url | string | nullable, max: 500 | no |
| active | boolean | required, default: true | no |

- product_id 指向 product。
- options 必填，type 是 json。內容把規格名稱對到所選的值：每個鍵必須是 product.options 某一組的 name，每個值必須是該組 values 裡的一個 string。例如顏色對到黑色，尺寸對到大。
- image_url 選填。

## CRUD

- create、get、update（以 If-Match 樂觀鎖）、delete（軟刪除）。
- list：依 product_id 篩選，每頁最多 100 筆。

對應的 CRUD 表：

| method | options |
| --- | --- |
| create | - |
| get | - |
| list | max-page-size: 100, filter: [product_id] |
| update | optimistic-lock: if-match |
| delete | soft: true |

## Policies

啟用並強制 RLS。租戶欄位由平台自動加入，不需宣告。

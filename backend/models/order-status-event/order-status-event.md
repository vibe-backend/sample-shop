# order-status-event

## Table

訂單狀態歷程。每次訂單狀態轉換（建立、付款、取消、出貨、送達）各新增一列；建立後不可修改或刪除。lock 正文由標題 `## Table` 開始，其後只接 `## Fields`、`## CRUD`、`## Policies`。表名只寫在這一節的 table 鍵。

- provider: main
- table: order_status_events
- owner-key: user_id

owner-key 為 user_id：買家只能讀取自己訂單的歷程；店員經由 order.staff-list／order.staff-set-status 讀寫。

## Fields

Fields 用表格，欄位是 name、type、rules、system。type 只可填 uuid、string、string[]、integer、number、boolean、timestamp、password、json、bytes，照下表抄寫。

| name | type | rules | system |
| --- | --- | --- | --- |
| order_id | uuid | required | no |
| user_id | uuid | required | no |
| status | string | required | no |
| at | timestamp | required, default: now | no |
| actor | string | required | no |

- order_id 指向 order。
- user_id 是訂單買家的 id（與 orders.user_id 相同，店員操作時亦填買家 id，不是店員 id）。
- status 只能是 pending、paid、shipped、delivered、cancelled 之一（轉換後的狀態；建立訂單時為 pending）。
- at 預設 now()；輸出為 ISO 8601 UTC。
- actor 只能是 buyer、staff、system 之一（僅供稽核，不輸出給前端）。

## CRUD

不注入內建 list、update、delete。這一節在 lock 寫 (none)。只經由 order.place、order.pay、order.cancel、order.confirm-delivery、order.staff-set-status 新增。

## Policies

啟用並強制 RLS。租戶欄位由平台自動加入，不需宣告。

## 輸出

嵌入訂單時只輸出 status 與 at，依 at 與 id 由舊到新排序，作為 Order 的 status_history。

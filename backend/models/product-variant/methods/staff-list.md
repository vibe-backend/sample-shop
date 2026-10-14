# staff-list

需要 staff；非店員回 403 FORBIDDEN。驗證 product_id 屬於目前 tenant 的未刪除商品，
包含 inactive 商品；不存在回 404 NOT_FOUND。讀取 product_variants，product_id = 指定商品，
包含 active 與 inactive，依 created_at、id 排序，不截斷結果、不自動產生選項組合。
回傳 ProductVariant[]，每筆包含 active、version、reserved_stock；in_stock = active AND stock > 0。
這個 method 不寫入資料。店員不能透過 body 指定 tenant 或 user。

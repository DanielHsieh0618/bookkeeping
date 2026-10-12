# Backend 由 Django 換成 FastAPI — 設計

日期：2026-10-03

## 背景

`apps/backend` 目前是 Django + Django REST Framework，已完成並在本機驗證過（見 [frontend-backend-split.md](../../plans/frontend-backend-split.md)），但還沒部署。使用者想藉這個專案學習 FastAPI，所以把 backend 換成 FastAPI。Backend 尚未部署，現在換的成本最低。

## 目標與範圍

- 把 `apps/backend` 的 framework 換成 FastAPI，資料層換成 raw SQL。
- 對外行為不變：URL 路徑、JSON 欄位名稱、JWT 與 `x-internal-secret` 的驗證方式都維持原樣，`apps/frontend` 不需要修改。
- 不在範圍內：部署（原計劃的 Task 14）、改名成 piggy、任何新功能。

## 決策

1. **Framework：FastAPI，以 `uvicorn` 執行。** 本機開發與 Docker 都用 `uvicorn`，本機用 `--ssl-certfile`／`--ssl-keyfile` 提供 HTTPS，用 `--reload` 自動重載。
2. **資料層：raw SQL，使用 psycopg 3。** 不使用 ORM。所有 SQL 集中在 `app/services.py`，一律用參數化查詢（`%s`），不做字串拼接。
3. **使用 async。** Endpoint 是 `async def`，資料庫連線來自 `psycopg_pool.AsyncConnectionPool`。Pool 在 FastAPI 的 lifespan 開啟與關閉，每個 request 透過 `Depends` 取得一條連線，endpoint 正常結束時 commit，發生例外時 rollback。這個 dependency 使用 `scope="function"`，確保 commit 在 response 送出之前完成；FastAPI 預設是送出之後才收尾，那樣 commit 失敗時 client 會先收到成功的回應。
4. **Schema 用 `app/schema.sql` 管理。** 內容是三張表的 `CREATE TABLE IF NOT EXISTS`，app 啟動時套用。沒有 migration 工具，之後要改 schema 需要手寫 `ALTER TABLE`。
5. **設定用 `pydantic-settings`。** 讀取 `DATABASE_URL`、`JWT_SECRET`、`INTERNAL_API_SECRET`、`FRONTEND_URL`，保留與現在相同的本機開發預設值。`DJANGO_SECRET_KEY` 不再需要。
6. **拿掉 `wait_for_db` 與 `docker-entrypoint.sh`。** Pool 開啟時用 `open(wait=True, timeout=30)` 等資料庫就緒，schema 在 lifespan 套用，不需要另外的啟動 script。
7. **測試打真的 Postgres。** 使用獨立的 `bookkeeping_test` 資料庫（不存在時自動建立），每個測試前清空三張表。測試程式會檢查資料庫名稱以 `_test` 結尾才執行，避免誤清開發資料。

## 目錄結構

```
apps/backend/
├── app/
│   ├── main.py        FastAPI app、lifespan、CORS、掛 router、/health
│   ├── config.py      Settings（pydantic-settings）
│   ├── db.py          建立 pool、套用 schema、get_conn dependency
│   ├── schema.sql     三張表的 CREATE TABLE IF NOT EXISTS
│   ├── auth.py        JWT 驗證、path 擁有者檢查、internal secret 檢查
│   ├── deps.py        共用的 dependency 型別別名與「取得擁有者 user_id」
│   ├── schemas.py     Pydantic request／response model、日期格式轉換
│   ├── services.py    所有 SQL
│   └── routers/
│       ├── categories.py
│       ├── records.py
│       ├── users.py
│       └── internal.py
├── tests/
├── certificates/      本機 HTTPS 憑證（不進 git）
├── Dockerfile
├── pyproject.toml
└── uv.lock
```

## API 行為

| 路由 | 驗證 | 行為 |
|---|---|---|
| `GET /health` | 無 | `{"status": "ok"}` |
| `GET /users/{user_google_id}/categories` | JWT，subject 必須等於路徑參數 | 回傳該使用者的分類 |
| `GET /users/{user_google_id}/records` | 同上 | 回傳該使用者的紀錄 |
| `POST /users/{user_google_id}/records` | 同上 | 新增紀錄，`user_id` 由 server 端依路徑參數查出 |
| `GET /records` | JWT | 回傳所有紀錄 |
| `POST /records` | JWT | 新增紀錄，`userId` 來自 request body |
| `GET /userInfo` | JWT | 回傳 JWT subject 對應的 user 資料列 |
| `POST /internal/users/bootstrap` | `x-internal-secret` header | 使用者不存在時建立 user 與預設分類 Food／apple；可重複呼叫 |

狀態碼：

- 沒帶 token、token 無效、token 沒有 `sub`：401，並帶 `WWW-Authenticate: Bearer`。
- JWT subject 與路徑的 `user_google_id` 不符：403。
- `x-internal-secret` 缺少或不符：403。
- 找不到對應的 user：404。
- Request body 驗證失敗：422。

## 與 Django 版本的差異

以下是刻意的改變，其餘行為相同：

1. **`amount` 以 JSON 數字回傳。** Django 版本回傳字串（例如 `"12.50"`），frontend 的圖表以 `+=` 加總時會變成字串相接。改成數字後符合 frontend 宣告的 `amount: number`。資料庫欄位仍是 `NUMERIC(12, 2)`。
2. **Request 驗證失敗回 422，不是 400。** 這是 FastAPI 的預設，frontend 沒有依賴這個狀態碼。
3. **`recordDate` 無法解析時回 422。** Django 版本會回 500。
4. **`POST /internal/users/bootstrap` 缺少欄位時回 422。** Django 版本會回 500。
5. **Bootstrap 改用 `INSERT ... ON CONFLICT DO NOTHING`。** 兩個同時進來的呼叫不會互相衝突。
6. **多了 `/docs` 與 `/openapi.json`。** FastAPI 自動產生的 API 文件。

## 資料相容性

本機 Postgres volume 裡已有 Django migration 建立的 `users`、`categories`、`records`。`schema.sql` 的欄位定義與這三張表一致，加上使用 `IF NOT EXISTS`，所以既有資料可以直接沿用，不需要清空 volume。Django 自己建立的表（`django_migrations`、`auth_*`、`django_content_type`）會留在資料庫裡，不影響運作。

Django 版本的 `uuid` 與 `description` 預設值是在 Python 端產生的，資料庫欄位本身沒有 default，所以 `INSERT` 一律明確帶入這兩個值，這樣在舊表與新表上都能運作。

## 錯誤處理

- 驗證與授權失敗一律用 `HTTPException`，回應格式為 `{"detail": "..."}`，與 DRF 相同。
- Internal secret 用 `secrets.compare_digest` 比對。
- 資料庫連線的交易範圍是一個 request：endpoint 丟出例外時整個 request 的寫入都會 rollback。

## 測試

- 以 `fastapi.testclient.TestClient` 做 HTTP 層級的測試，涵蓋每條路由的 401／403／404／200 情境、bootstrap 可重複呼叫、`amount` 是數字、日期格式轉換與 422。
- Django 版本的 view 測試案例逐一搬過來，作為行為沒有改變的依據。
- `wait_for_db` 與 model 的測試隨對應的程式碼一起移除。

## 驗證方式

1. `uv run pytest` 全部通過。
2. `docker compose up --build` 後，`curl -k https://localhost:4000/health` 回 200；修改 host 上的程式碼會自動重載。
3. `pnpm run dev:backend` 可在本機以 HTTPS 啟動。
4. 既有的本機資料在換完之後仍然讀得到。
5. `apps/frontend` 沒有任何變更，`pnpm run lint` 通過。

## 風險

- **`backend_venv` volume 是舊的。** 這個 named volume 裡是 Django 版本的套件，image 重建後不會自動更新，必須刪除這個 volume 讓它重新產生。只刪 `backend_venv`，不刪 `pgdata`。
- **沒有 migration 工具。** Schema 變更要手動處理，這是選擇 raw SQL 的代價。
- **`CREATE TABLE IF NOT EXISTS` 不適合多個 process 同時啟動。** 目前只跑單一 `uvicorn` process，沒有這個問題；之後若改成多個 worker，要把 schema 套用移出 lifespan。

## 實作後的修正（2026-10-03）

換完之後發現 income 紀錄存不進去，追查後做了以下修正，這些已超出原本「frontend 不修改」的範圍：

- **`records.category_id` 改成可為空值。** income 沒有分類。Request 的 `categoryId` 變成選填，response 的 `category_id` 可能是 `null`。`schema.sql` 結尾加了一行可重複執行的 `ALTER TABLE ... DROP NOT NULL`，讓既有資料庫在啟動時自動跟上。
- **Frontend 的新增紀錄表單**：income 送 `categoryId: null`（原本送 `0`）；expenses 的預設分類改成使用者的第一個分類（原本寫死 `1`）；儲存失敗時顯示錯誤並留在表單（原本不檢查回應）。
- **Frontend 的紀錄列表**：沒有分類的紀錄在圖表上歸到 `Uncategorized`。

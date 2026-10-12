# Frontend / Backend 拆分 — 手動執行 Checklist

> **2026-10-03 更新：** Backend 已由 Django + DRF 換成 FastAPI + raw SQL，設計見 [2026-10-03-fastapi-backend-design.md](../superpowers/specs/2026-10-03-fastapi-backend-design.md)。本文件中關於 Django 的內容（ORM、migration、gunicorn、`wait_for_db`）是歷史紀錄，不再反映目前的程式碼；前後端拆分、JWT 橋接、部署方式等決策仍然有效。

依照順序執行即可，每一項的詳細程式碼都在 [docs/superpowers/plans/2026-09-13-frontend-backend-split.md](../superpowers/plans/2026-09-13-frontend-backend-split.md) 裡對應的 Task 底下；背景與決策說明見 [docs/plans/frontend-backend-split.md](./frontend-backend-split.md)。

Backend 是 Django + Django REST Framework（用 uv 管理），跑測試前記得先啟動 Postgres（`docker compose up -d postgres`，或任何本機可連線的 Postgres）。

## Task 1 — Root workspace + 搬移 frontend
- [x] `git mv` 現有檔案進 `apps/frontend/`（`src`、`public`、`certificates`、各種 config、`package.json`、`.env.development.local`、`.vercel`），刪掉舊的 `package-lock.json`（改用 pnpm）
- [x] 建立薄薄的 root `package.json`（先只裝 `concurrently`，之後 Task 13 再補 scripts）
- [x] `pnpm install`（root）+ `pnpm install`（`apps/frontend/` 裡面）+ `pnpm --dir apps/frontend run dev` 確認搬完還能跑
- [x] 更新 `.gitignore`
- [x] commit（`6456cec`）

## Task 2 — Backend 專案骨架（uv + Django + DRF）
- [x] `uv init` + `uv add django djangorestframework django-cors-headers dj-database-url "psycopg[binary]" pyjwt python-dateutil gunicorn` + `uv add --dev pytest pytest-django`
- [x] `django-admin startproject config .` + `python manage.py startapp api`
- [x] `pyproject.toml` 補上 `[tool.uv] package = false`、`[tool.pytest.ini_options]`
- [x] 改 `config/settings.py`（`INSTALLED_APPS`、`DATABASES` 用 `dj_database_url`、`CORS_ALLOWED_ORIGINS`、`JWT_SECRET`/`INTERNAL_API_SECRET`，都用 `os.environ.get(..., 開發預設值)`）
- [x] 改 `api/apps.py`
- [x] 建立 `.env.example`、`.gitignore`
- [x] `uv run python manage.py check` + `uv run pytest`（還沒測試也不報錯；另外把 `config/urls.py` 的預設 `admin/` route 清掉，因為 `INSTALLED_APPS` 沒裝 `django.contrib.admin`，不然 `check` 會炸）
- [x] commit（`651cc3b`）

## Task 3 — Model + migration
- [x] 寫 `api/models.py`（`User`、`Category`、`Record`，`db_table` 對應現有資料表名稱；`User.uuid` 的 default 要用具名函式 `generate_uuid()`，不能用 lambda——Django migration writer 沒辦法序列化 lambda）
- [x] `python manage.py makemigrations api` 產生 `0001_initial.py`，檢查內容
- [x] 寫 `tests/test_models.py` → 跑測試確認 pass（記得先啟動 Postgres；本機用 `docker run postgres:16-alpine` 起了一個暫時的容器）
- [x] commit（`6e924e9`）

## Task 4 — `api/services.py`
- [x] 寫測試（`get_user_id_by_google_id`／`bootstrap_user`／`to_date_string`）→ 確認 fail
- [x] 實作 → 確認 pass（6 tests）
- [x] commit（`5c61fe9`）

## Task 5 — JWT authentication + internal secret permission
- [x] 寫測試（`JWTAuthentication`／`GoogleUser`／`HasInternalSecret`）→ fail
- [x] 實作 `api/authentication.py`（含 `authenticate_header` 回傳 `"Bearer"`，不然 401 會被 DRF 降成 403）、`api/permissions.py` → pass（15 tests 全過）
- [x] commit（`c5bc4cc`）

## Task 6 — Serializers + Categories view
- [x] 寫測試（401/403/404/200 四種情境）→ fail
- [x] 實作 `api/serializers.py`（`CategorySerializer` 等）、`api/views.py`（`AuthenticatedAPIView`、`CategoryListView`）、`api/urls.py`、掛進 `config/urls.py` → pass（19 tests 全過，含 `/health` endpoint）
- [x] commit（`bd6baf6`）

## Task 7 — Records views
- [x] 寫測試（`/users/<id>/records` GET/POST、全域 `/records` GET/POST）→ fail
- [x] 實作 `UserRecordsView`、`GlobalRecordsView`，掛進 `api/urls.py` → pass（25 tests 全過）
- [x] commit（`3fdcf8c`）

## Task 8 — UserInfo + Internal bootstrap view
- [x] 寫測試 → fail
- [x] 實作 `UserInfoView`、`InternalBootstrapView`，掛進 `api/urls.py` → pass（29 tests 全過）
- [x] commit（`f8220ca`）

## Task 9 — `wait_for_db` management command
- [x] 寫測試（patch `api.management.commands.wait_for_db.connections`，不是 `django.db.connections`）→ fail
- [x] 實作 → pass（32 tests 全過）
- [x] commit（`72dbc1d`）

## Task 10 — Dockerfile + docker-compose
- [x] 寫 `Dockerfile`（uv sync --frozen --no-dev）、`.dockerignore`、`docker-entrypoint.sh`（`wait_for_db` → `migrate --noinput` → `exec`；每個 `uv run` 都要加 `--no-sync`，不然 container 啟動時的隱性 sync 會把 `--no-dev` 排除的 pytest 等套件又裝回去）
- [x] 寫 `docker-compose.yml`（postgres + backend，不需要 schema.sql，migration 自動處理）
- [x] `docker compose up --build`，`curl /health` 驗證，確認不用手動 restart（用 `docker compose down -v` 完全重來一次驗證 `wait_for_db` 真的會重試）
- [x] commit（`47e1af3`，另外 `9644a04` 補記 `--no-sync` gotcha）

## Task 11 — Frontend auth 串接
- [x] `apps/frontend` 裝 `jsonwebtoken`
- [x] 改 `next-auth.d.ts`（加 `apiToken`）
- [x] 改 `configs/auth.ts`（簽發 `session.apiToken`、`events.signIn` 改呼叫 `/internal/users/bootstrap`）
- [x] `.env.development.local` 補上 `NEXT_PUBLIC_API_URL`／`BACKEND_JWT_SECRET`／`INTERNAL_API_SECRET`
- [x] commit（`c97be00`；`tsc --noEmit` 過，實際登入驗證留到 Task 14）

## Task 12 — Frontend fetch 呼叫改寫 + 刪舊路由
- [x] 改 `record/page.tsx`、`records/page.tsx` 的 fetch（改打 backend + 帶 JWT）
- [x] 重新 grep 確認沒有漏改的呼叫點
- [x] 刪除 `src/app/api/records`、`userInfo`、`users`（**不要刪 `api/auth`**）
- [x] 移除 `@vercel/postgres` 依賴 + `page.tsx` 裡的死 import（順便發現 `uuid`/`@types/uuid` 也變成死依賴，一起移除）
- [x] `pnpm --dir apps/frontend run lint`（過）+ `tsc --noEmit`（過）
- [x] commit（`4f53f1b`）

## Task 13 — 本機 HTTPS + root package.json scripts + README
- [x] 複製憑證到 `apps/backend/certificates/`（gitignored，跟 frontend 憑證一樣）
- [x] 補上 root `package.json` 的 `dev`/`dev:frontend`/`dev:backend`（backend 用 `uv run --directory apps/backend gunicorn ... --certfile=... --keyfile=...`）/`build`/`lint` scripts
- [x] 驗證 `dev:backend` 單獨跑得起來（`https://localhost:4000/health` 回 200；需要先跑過 migrate 對一個可連線的 Postgres）——完整 `pnpm run dev` 含 Google 登入的瀏覽器互動驗證留到 Task 14
- [x] 更新 README（Getting Started／Tech Stack／Project Structure／Deployment 都改成兩個 app 的說明，順便把殘留的 `npm run lint` 改成 `pnpm run lint`）
- [x] commit（`b61d49b`）

## Task 14 — Vercel + Render/Neon 部署 + 完整驗證
- [ ] Vercel dashboard 把 Root Directory 改成 `apps/frontend`
- [ ] 推分支確認 Vercel preview 能 build
- [ ] Neon 或 Supabase 申請免費 Postgres，取得連線字串
- [ ] Render 建立免費 Web Service，Root Directory 設 `apps/backend`，用 Dockerfile 部署；填入 `DATABASE_URL`（指向 Neon/Supabase）、`JWT_SECRET`、`INTERNAL_API_SECRET`、`FRONTEND_URL`、`DJANGO_SECRET_KEY`
- [ ] curl Render 網址的 `/health` 確認回 200
- [ ] Vercel 環境變數 `NEXT_PUBLIC_API_URL` 指向 Render 網址
- [ ] 跑完整流程：登入 → 補建 user/category → 載入分類 → 新增紀錄（正式環境，非本機）
- [ ] 401 驗證（缺 token／錯 token）
- [ ] `uv run pytest`（backend）、`pnpm --dir apps/frontend run lint`、`pnpm run build` 全過
- [ ] `docker compose down` 收尾

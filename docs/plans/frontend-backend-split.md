# 將 bookkeeping 拆成 apps/frontend + apps/backend

> **2026-10-03 更新：** Backend 已由 Django + DRF 換成 FastAPI + raw SQL，設計見 [2026-10-03-fastapi-backend-design.md](../superpowers/specs/2026-10-03-fastapi-backend-design.md)。本文件中關於 Django 的內容（ORM、migration、gunicorn、`wait_for_db`）是歷史紀錄，不再反映目前的程式碼；前後端拆分、JWT 橋接、部署方式等決策仍然有效。

## 背景說明

目前這個專案是一個單一的 Next.js 14（App Router）應用程式，UI、API route handler、以及直接寫在裡面的 raw SQL（`@vercel/postgres`）全部混在一起，直接部署到 Vercel。使用者希望在維持單一 repo 的前提下，把前端和後端的職責分開，讓 API 不再綁死在 Next.js 的慣例上、可以獨立部署，並且讓 route/HTTP 程式碼跟 DB 邏輯之間有更清楚的界線。

已經和使用者確認過的決策（不要再重新討論這些）：
1. **Backend 語言/框架：Python + Django + Django REST Framework (DRF)**——Django 是全功能框架（內建 ORM、migration、admin），DRF 負責 API 層：serializer 做 request/response 驗證（目前的 route 完全沒有做 input 驗證）、authentication/permission 機制掛 JWT 驗證。
2. **DB 存取方式：改用 Django ORM + migrations**，放棄原本「維持 raw SQL、不用 ORM」的方向——既然選了 Django，就順著它的慣例走：定義 `User`/`Category`/`Record` model，用 Django 內建的 migration 系統管理 schema（這個專案原本完全沒有 migration 檔案，schema 都是手動管理，這次順便解決掉）。
3. **Python 套件/環境管理：uv**——單一工具處理虛擬環境、套件安裝、lockfile（`uv.lock`），對應到 frontend 那邊 pnpm 的角色，跟 Django/DRF 這個選擇本身沒有衝突。
4. **不再是單一語言的 monorepo**：因為 backend 換成 Python，`apps/frontend`（Next.js/pnpm）和 `apps/backend`（Django/uv）變成兩個各自獨立管理套件的專案，不再用 pnpm workspaces 或任何 JS monorepo 工具把兩者綁在一起。Root 只留一個很薄的 `package.json`（僅裝 `concurrently`），負責用一行指令同時啟動兩邊的 dev server；frontend 需要自己在 `apps/frontend/` 底下另外跑一次 `pnpm install`。
5. **Auth：NextAuth 留在 frontend**（Google OAuth + session cookie 不變，這部分完全不受 backend 換語言/框架影響）。NextAuth 另外會簽發一個短效期的 JWT（`session.apiToken`），frontend 呼叫 backend 時以 `Authorization: Bearer` 的方式帶上去。Backend 端用 PyJWT 包成一個 DRF authentication class 來驗證，雙方共用一組 secret。
6. **Backend 部署：透過 Docker 部署到另一台獨立的 host**（本機開發用 Dockerfile + docker-compose）。Frontend 部署維持在 Vercel 不變——但搬家之後，Vercel 專案的 **Root Directory** 設定必須改成 `apps/frontend`。
   - **免費部署方案（推薦）：Render（免費 web service，直接吃我們規劃好的 `apps/backend/Dockerfile`）+ Neon 或 Supabase（免費 serverless Postgres）。** Render 的免費 Postgres 只保留 90 天會被刪，所以資料庫改用 Neon 或 Supabase 的免費方案（無限期保留），只要把 `DATABASE_URL` 指過去即可，不需要改任何程式碼。Render free tier 的取捨：閒置一段時間會 sleep，喚醒有幾秒 cold start，正式使用前要先確認這點對這個 app 是可接受的。
   - 替代方案：Fly.io（有免費額度可以跑小型 VM + Docker，但需要綁信用卡，額度也比較容易因多個 app/region 超支）。
   - 不採用 Vercel 的 Python serverless functions 部署 backend：那是 stateless serverless function 模型，跟我們規劃的「常駐 gunicorn + DB connection pool + Docker」架構不合。
7. **登入時的資料初始化**（`auth.ts` 裡的 `events.signIn` 目前會直接下 raw SQL，在第一次登入時建立 user 跟預設分類）：改成呼叫 backend 新增的一支 endpoint（例如 `POST /internal/users/bootstrap`），用 server-to-server 共用密鑰保護（不是用一般使用者的 JWT，因為這個時間點還沒有正常的已登入 session）。Frontend 改成用 HTTP 呼叫它，不再直接碰 Postgres——讓所有 DB 存取都只留在 backend。
8. **孤兒路由** `/api/records`（全域、沒有依 user 區分）和 `/api/userInfo`（只是把 NextAuth session 原樣回傳）在目前的 frontend 程式碼裡都找不到任何呼叫的地方，但仍然決定照樣搬過去（不刪除），並且跟其他路由一樣掛上 JWT 驗證。`/userInfo` 的行為勢必要改變，改成回傳 JWT 對應 google id 的 DB user 資料列（backend 端沒有 NextAuth session 可以回傳）——這是刻意的行為變更，不是單純的搬移，要特別註明。
9. **加強授權檢查**：像 `GET /users/{user_google_id}/records` 這類路由，會檢查 JWT 裡的 subject 是否等於路徑參數 `user_google_id`，不符就回傳 403——這順便補上一個目前真實存在的漏洞（現在任何登入的人只要改網址就能讀寫別人的資料），算是這次重構順便修掉的問題。
10. **本機開發用的 HTTPS**：backend 本機開發也一併用 HTTPS（沿用或另外準備一組 self-signed 的 localhost 憑證），而不是把 frontend 的 HTTPS 拿掉——這樣才不用去動 Google OAuth 的 redirect URI 設定，也比較貼近正式環境中雙方都是 HTTPS 的樣子。Django 內建的 `runserver` 不支援 HTTPS，所以本機開發跟正式環境一律用 `gunicorn`（支援 `--certfile`/`--keyfile`，也支援 `--reload`），維持單一種跑法。

## 目標的目錄結構

```
bookkeeping/
├── apps/
│   ├── frontend/                      (git mv 現有的 app；行為維持不變；獨立的 pnpm 專案)
│   │   ├── src/... (拿掉 src/app/api/* 這些 route handler，搬去 backend)
│   │   ├── certificates/              (git mv，本機 https 還是要用)
│   │   ├── package.json               (只留 frontend 需要的依賴)
│   │   └── pnpm-lock.yaml             (frontend 自己的 lockfile)
│   └── backend/                       (新的 Django + DRF app；獨立的 uv 專案)
│       ├── manage.py
│       ├── config/                    (Django project：settings/urls/wsgi)
│       │   ├── __init__.py
│       │   ├── settings.py
│       │   ├── urls.py
│       │   └── wsgi.py
│       ├── api/                       (Django app：所有業務邏輯)
│       │   ├── __init__.py
│       │   ├── apps.py
│       │   ├── models.py              (User、Category、Record)
│       │   ├── migrations/
│       │   ├── serializers.py
│       │   ├── authentication.py      (JWT DRF authentication class)
│       │   ├── permissions.py         (internal secret permission)
│       │   ├── services.py            (get_user_id_by_google_id、bootstrap_user、to_date_string)
│       │   ├── views.py
│       │   ├── urls.py
│       │   └── management/commands/wait_for_db.py  (DB 連線重試)
│       ├── tests/                     (pytest + pytest-django)
│       ├── pyproject.toml             (django、djangorestframework、django-cors-headers、dj-database-url、psycopg[binary]、pyjwt、python-dateutil、gunicorn；dev 用 pytest、pytest-django)
│       ├── uv.lock
│       ├── Dockerfile / .dockerignore / docker-entrypoint.sh
│       └── certificates/              (本機 dev 用的 self-signed localhost 憑證)
├── docker-compose.yml                 (postgres + backend，給本機開發用；frontend 還是直接在host上跑 `next dev`)
├── package.json                       (root；只裝 `concurrently`，負責一行指令同時起兩邊 dev server)
└── README.md                          (更新：架構、dev/build/deploy 說明)
```

## 遷移步驟（依序執行）

1. **建骨架 + 搬移現有程式碼。** 建立 `apps/frontend/`，把現有的檔案/目錄用 `git mv` 搬進去（`src/`、`public/`、`certificates/`、`next.config.mjs`、`tailwind.config.ts`、`postcss.config.*`、`components.json`、`next-auth.d.ts`、`next-env.d.ts`、`.eslintrc.json`、`tsconfig.json`、`package.json`、`.env.development.local`、`.vercel/`）。刪掉舊的 `package-lock.json`（改用 pnpm，不再需要；也不需要共用 tsconfig——backend 換成 Python 之後，frontend 是這個 repo 裡唯一的 TypeScript 專案）。建立一個很薄的 root `package.json`（只裝 `concurrently`）。跑 `pnpm install`（root，只裝 concurrently）+ `pnpm install`（在 `apps/frontend/` 裡面，裝 frontend 真正的依賴），確認 frontend 搬到新位置後還能正常 build/run，再動手處理 backend。

2. **建立 `apps/backend` 骨架。** 用 `uv init` 建立一個獨立的 Python 專案，再用 `django-admin startproject config .`（Django project，內含 `settings.py`/`urls.py`/`wsgi.py`）+ `python manage.py startapp api`（放實際業務邏輯的 Django app）。`pyproject.toml` 依賴：django、djangorestframework、django-cors-headers、dj-database-url（把單一 `DATABASE_URL` 解析成 Django 的 `DATABASES` 設定）、psycopg[binary]（Django 5 支援 psycopg3）、pyjwt、python-dateutil、gunicorn；dev dependencies：pytest、pytest-django。`[tool.uv] package = false`。`settings.py` 設定 `INSTALLED_APPS`（含 `rest_framework`、`corsheaders`、`api`）、`DATABASES`（用 `dj_database_url.parse(...)`）、`CORS_ALLOWED_ORIGINS`、`JWT_SECRET`/`INTERNAL_API_SECRET`（讀環境變數）。

3. **定義 model + 產生 migration。** `api/models.py` 定義 `User`（`user_id` 主鍵、`google_id`、`email`、`user_name`、`uuid`）、`Category`（`category_id` 主鍵、`user` FK、`category_name`、`category_icon`）、`Record`（`record_id` 主鍵、`record_date`、`record_type`、`amount`、`category` FK、`user` FK、`description`），`Meta.db_table` 對應現有的資料表名稱（`users`/`categories`/`records`），FK 欄位命名沿用 Django 預設（`user`→`user_id` 欄、`category`→`category_id` 欄，剛好跟現有 schema 一致）。跑 `python manage.py makemigrations` 產生 `0001_initial.py`——這個專案原本完全沒有 migration 檔案（schema 手動管理），這次補上，之後 `docker compose up` 會自動跑 migration 而不需要另外準備 `schema.sql`。

4. **一次搬一支路由**，每搬完一支就用 curl 驗證過再搬下一支：

   | 舊檔案 | 新的 backend 檔案 | 新路由 |
   |---|---|---|
   | `src/app/api/users/[user_google_id]/categories/route.ts` | `api/views.py`（`CategoryListView`） | `GET /users/{user_google_id}/categories` |
   | `src/app/api/users/[user_google_id]/records/route.ts` | `api/views.py`（`UserRecordsView`） | `GET/POST /users/{user_google_id}/records` |
   | `src/app/api/records/route.ts` | `api/views.py`（`GlobalRecordsView`） | `GET/POST /records`（保留，依決策 8 掛上 JWT 驗證） |
   | `src/app/api/userInfo/route.ts` | `api/views.py`（`UserInfoView`） | `GET /userInfo`——改成回傳 JWT subject 對應的 DB user 資料列，而不是 NextAuth session（行為變更，見決策 8） |
   | `configs/auth.ts` 裡 `events.signIn` 的初始化邏輯 | `api/services.py`（`bootstrap_user`）、`api/views.py`（`InternalBootstrapView`） | `POST /internal/users/bootstrap`——用 server-to-server 共用密鑰保護，不是用一般使用者的 JWT（見決策 7） |

   每搬一支路由時：修掉 categories 路由裡沒檢查就直接存取 `users[0].user_id` 的問題（改成優雅處理找不到 user 的情況，回 404），並加上 JWT subject 跟 `user_google_id` 是否相符的檢查（不符回 403，見決策 9）。順手拿掉殘留的 debug `print`。`new Date(recordDate).toDateString()` 這個既有的日期格式小怪癖維持原樣（這次不是要「順便修掉」它的範圍），Python 端用 `python-dateutil` 解析輸入日期、再手動組出同樣格式的字串（`"Www Mmm d yyyy"`，日期不補零，對應 JS `Date.prototype.toDateString()` 的輸出）。

   等所有路由都搬完、並且都手動驗證過之後，才把 `apps/frontend` 裡的 `src/app/api/**` 和 `events.signIn` 裡的 SQL 刪掉。

5. **Auth 串接。**
   - Frontend（`apps/frontend/src/app/configs/auth.ts`）：在 `session` callback 裡加上 `session.apiToken = jwt.sign({ sub: token.sub }, process.env.BACKEND_JWT_SECRET, { expiresIn: '15m' })`；在 `next-auth.d.ts` 的 `Session` 型別裡加上 `apiToken`。把 `events.signIn` 裡的 SQL 換成呼叫 backend 的 `/internal/users/bootstrap`，用 server-to-server 的共用密鑰驗證（例如 `INTERNAL_API_SECRET`，跟給使用者用的 `BACKEND_JWT_SECRET` 是不同的東西）。
   - Backend（`api/authentication.py`）：一個 DRF `BaseAuthentication` 子類讀取 `Authorization: Bearer <token>`，用 `pyjwt` 的 `jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])` 驗證（這個值要跟 frontend 的 `BACKEND_JWT_SECRET` 一致），驗證成功回傳一個帶 `google_id`/`is_authenticated=True` 的輕量物件（讓 DRF 內建的 `IsAuthenticated` permission 能正常判斷），失敗就丟 `AuthenticationFailed`（DRF 轉成 401）。`/internal/*` 路由用另一個 `permissions.BasePermission` 子類，檢查 `x-internal-secret` header 是否等於 `INTERNAL_API_SECRET`，不掛 JWT authentication。

6. **Frontend 的 fetch 呼叫改寫**——目前已知的 3 個呼叫點（`apps/frontend/src/app/records/page.tsx`、`apps/frontend/src/app/record/page.tsx` 裡兩處）：把 `fetch('/api/...')` 改成 `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/...\`)`，加上 `Authorization: Bearer ${session.apiToken}` header，拿掉已經沒有意義的 `credentials: "same-origin"`。實際動手時記得重新在 `src/` 裡 grep 一次 `fetch(`，以防這份計劃寫完之後又新增了其他呼叫點。

7. **CORS + 本機 HTTPS。** 用 `django-cors-headers`（`CorsMiddleware` + `CORS_ALLOWED_ORIGINS = [FRONTEND_URL]`、`CORS_ALLOW_CREDENTIALS = False`，用 Bearer token 做驗證，不是靠 cookie 跨域，所以不需要）。Backend 的 dev server 用 `gunicorn ... --certfile=... --keyfile=...` 跑 HTTPS（沿用或複製 `apps/frontend/certificates/*.pem`），依決策 10 執行。

8. **Dockerfile + docker-compose + DB 連線重試。** `apps/backend/Dockerfile` 用 Python 官方 slim image，裝 `uv`、跑 `uv sync --frozen --no-dev`；`docker-compose.yml` 裡 backend service 的 `context` 直接設成 `./apps/backend`。新增 `api/management/commands/wait_for_db.py`（自訂 Django management command，重試連線直到 Postgres 真的能接受連線為止，而不是只等 container 啟動）跟 `docker-entrypoint.sh`（依序跑 `manage.py wait_for_db` → `manage.py migrate --noinput` → `exec "$@"`，也就是實際的 gunicorn 指令）。因為 schema 現在完全由 Django migration 管理，不再需要額外準備 `schema.sql` 初始化腳本。Root 的 `docker-compose.yml`：`postgres:16-alpine` + `backend` 兩個 service。

9. **環境變數重新分配。**
   - `apps/frontend/.env.development.local`：`GOOGLE_CLIENT_ID/SECRET`、`NEXTAUTH_URL`、`NEXTAUTH_SECRET`，新增 `NEXT_PUBLIC_API_URL`、`BACKEND_JWT_SECRET`、`INTERNAL_API_SECRET`。拿掉所有 `POSTGRES_*`（frontend 不再直接存取 DB）。
   - `apps/backend/.env`：`DATABASE_URL`（把原本一堆 `POSTGRES_*` 整合成一個連線字串，`dj-database-url` 解析；部署到 Render 時這個值改指向 Neon/Supabase 給的連線字串，本機開發跟 docker-compose 則指向本機 Postgres）、`JWT_SECRET`（要等於 frontend 的 `BACKEND_JWT_SECRET`）、`INTERNAL_API_SECRET`（要等於 frontend 那邊的值）、`FRONTEND_URL`、`DJANGO_SECRET_KEY`（Django 自己內部簽章用，跟上面三個都不同）。
   - 兩個 app 各自加一份 `.env.example`（不要放真正的密鑰）。

10. **Root 的 package.json（純粹是 orchestration，不是 workspace root）。**
    ```jsonc
    {
      "private": true,
      "scripts": {
        "dev": "concurrently -n backend,frontend -c blue,green \"pnpm run dev:backend\" \"pnpm run dev:frontend\"",
        "dev:frontend": "pnpm --dir apps/frontend run dev",
        "dev:backend": "uv run --directory apps/backend gunicorn config.wsgi:application --bind 0.0.0.0:4000 --reload --certfile=certificates/localhost.pem --keyfile=certificates/localhost-key.pem",
        "build": "pnpm --dir apps/frontend run build",
        "lint": "pnpm --dir apps/frontend run lint"
      },
      "devDependencies": { "concurrently": "^9.x" }
    }
    ```
    `pnpm --dir apps/frontend` 跟 `uv run --directory apps/backend` 都是直接指定資料夾執行，不需要 workspace 關係——因為現在 frontend 跟 backend 是兩個完全獨立、用不同語言/工具管理套件的專案。

11. **文件 + Vercel 設定 + backend 正式部署。** 更新 root 的 `.gitignore`（`apps/frontend/.next/`、`apps/frontend/out/`、`apps/backend/.venv`、`apps/backend/__pycache__`、`node_modules`）。更新 `README.md`，補上新架構的說明（frontend 是 pnpm 專案、backend 是 uv 管理的 Django 專案，兩者完全獨立；本機第一次啟動 backend 前要先跑一次 migration）。把 Vercel 專案的 **Root Directory** 設定改成 `apps/frontend`——這是必要步驟，搬家之後不改的話現有的部署會壞掉。Backend 依決策 6 部署到 Render（Dashboard 上選 "New Web Service" → 指到這個 repo、Root Directory 設 `apps/backend`、選擇用 Dockerfile 部署）+ Neon 或 Supabase（申請免費 Postgres，把連線字串填進 Render 的 `DATABASE_URL` 環境變數），並在 Render 的環境變數裡補齊 `JWT_SECRET`/`INTERNAL_API_SECRET`/`FRONTEND_URL`/`DJANGO_SECRET_KEY`（要跟 Vercel 上 frontend 設定的值互相對應）。部署完成後把 frontend 的 `NEXT_PUBLIC_API_URL`（Vercel 環境變數）指向 Render 給的網址。

## 需要留意的風險 / 眉角

- CORS 設定錯誤在瀏覽器上看起來會像是不明原因的 network failure，不會直接顯示明顯的 CORS 錯誤訊息——要特別去看 devtools 的 console。
- 本機開發時有兩個 base URL 都要設對：`NEXTAUTH_URL`（frontend 自己的 origin）跟 `NEXT_PUBLIC_API_URL`（backend）。在 `.env.example` 裡用註解把兩者都寫清楚。
- `INTERNAL_API_SECRET`、`JWT_SECRET`、`BACKEND_JWT_SECRET`、`DJANGO_SECRET_KEY` 是四個不同的密鑰，不要搞混（`DJANGO_SECRET_KEY` 是 Django 框架內部用的，跟 JWT/internal secret 完全無關）。另外要注意，frontend `auth.ts`（第 39 行）裡現有的 `secret: process.env.JWT_SECRET` 其實是 NextAuth 自己拿來簽章用的密鑰，跟新的 backend `JWT_SECRET` 完全無關——名稱重複容易搞混，可以考慮把 NextAuth 那個改名成 `NEXTAUTH_SECRET`（它目前預設值是 fallback 到 `"default-secret"`，代表這個變數現在可能根本沒被設定過——改名前要先確認清楚）。
- Docker Compose 的 `depends_on` 只會等 Postgres 這個 container「啟動」，不會等它「真的能接受連線」——`wait_for_db` management command 就是為了解決這個問題，不要跳過它直接跑 `migrate`。
- DRF 的自訂 authentication class 如果直接回傳一個字串當作 `request.user`，內建的 `IsAuthenticated` permission 會因為字串沒有 `.is_authenticated` 屬性而炸掉——要包成一個有 `is_authenticated = True` 的輕量物件。
- Django model 欄位的 `default=` 如果指定 `lambda`（例如 `User.uuid` 原本想寫 `default=lambda: str(uuid.uuid4())`），`makemigrations` 產生 migration 檔案時會直接丟 `ValueError: Cannot serialize function: lambda`——要改成具名函式（例如 `generate_uuid()`）當 default，Django 才能把它序列化進 migration 檔案裡。這個問題在實作 Task 3 時真的遇到了。
- Docker 容器裡跑 `uv run <command>` 預設會先做一次隱性的 `uv sync`，而且這個隱性 sync 不會套用 build time 的 `--no-dev`——結果是 image build 時特地用 `uv sync --frozen --no-dev` 排除掉的 `pytest`/`pytest-django` 等 dev 依賴，又在 container 啟動的當下被裝回去。要在 `docker-entrypoint.sh` 跟 Dockerfile 的 `CMD` 裡，每個 `uv run` 都加上 `--no-sync`，讓它直接沿用 image build 時準備好的環境，不要再重新 sync 一次。這個問題在實作 Task 10、實際跑 `docker compose up --build` 驗證時真的遇到了（用 `docker exec ... uv run python -c "import pytest"` 驗證確認修好後 prod container 裡真的抓不到 pytest）。
- Vercel 的 Root Directory 設定要跟搬檔案這個動作一起做，不要事後才想起來。
- Render 免費方案閒置後會 sleep，喚醒時第一個請求會有幾秒 cold start（frontend 第一次呼叫 backend 可能會 timeout 或明顯變慢）——如果之後要拿掉這個延遲，需要升級成付費方案，不是程式碼可以解決的問題。
- `apps/frontend` 跟 `apps/backend` 現在是完全獨立的兩個套件生態系——改 frontend 的依賴只需要在 `apps/frontend/` 裡跑 `pnpm`，改 backend 只需要在 `apps/backend/` 裡跑 `uv`，兩邊不會互相影響，但也代表沒有「一個指令裝好全部依賴」這種事，開發環境設定文件（README）要把這點寫清楚。

## 驗證方式

1. `apps/frontend` 裡跑 `pnpm install`、`apps/backend` 裡跑 `uv sync` 都要成功；`pnpm run build`（root，實際上只 build frontend）要能順利跑完。
2. Backend 單獨測試：本機先跑一次 `uv run --directory apps/backend python manage.py migrate`，再啟動 `pnpm run dev:backend`；用 curl 打有保護的路由、不帶 `Authorization` header → 應回 401；帶一組手動簽出來的合法 JWT → 應回 200 並帶回預期的 JSON。
3. `docker compose up --build` 要能把 Postgres 跟 backend 都啟動起來，backend 啟動時自動跑 `wait_for_db` + `migrate`，不需要手動介入；確認跟本機 gunicorn 開發模式的行為一致。
4. 完整跑一次 frontend 對接真正 backend 的流程：`pnpm run dev`（root，兩個 app 都跑起來），用 Google 登入（兩邊都是 HTTPS），確認登入初始化的呼叫有正確建立 user + 預設分類，前往 `/records` 和 `/record`，確認分類能正確載入、也能新增一筆紀錄並顯示出來——而且這些都要是打到 `NEXT_PUBLIC_API_URL`，不是打 `/api/...`。
5. 反向測試：不帶/帶錯/帶錯密鑰簽的 JWT → 應回 401；用 user A 的 JWT 去存取 `user_google_id` 是 user B 的路由 → 應回 403。
6. 整個流程跑下來 devtools 不應該出現任何 CORS 錯誤。
7. 拿掉 `src/app/api/**` 之後，frontend 的 lint 要能正常通過；backend 的 `uv run --directory apps/backend pytest` 要能全部通過。
8. 改完 Vercel 的 Root Directory 之後，推一個分支確認 Vercel 的 preview deployment 能從 `apps/frontend` 順利 build 出來。
9. Render 上的 backend 部署成功後，直接對 Render 給的網址 curl `/health` 應回 200；Vercel 上的 frontend 設定好 `NEXT_PUBLIC_API_URL` 指向 Render 網址後，完整跑一次登入 → 載入分類 → 新增紀錄的流程，確認正式環境（非本機）也是通的。

---

# 另一項任務：把專案名稱從「bookkeeping」改成「piggy」

跟上面的前後端拆分沒有關係——單純是改名字，已經用 repo 全域的 case-insensitive grep 搜尋過 "bookkeeping"（排除了 `node_modules`、`.git`、`.next`、`out`）加以確認。

## 需要修改的檔案

| 檔案 | 修改內容 |
|---|---|
| `package.json` | `"name": "bookkeeping"` → `"name": "piggy"` |
| lockfile（`pnpm-lock.yaml`，或還沒切換成 pnpm 的話是 `package-lock.json`） | 同樣的 `name` 欄位——不要手動改，改完 `package.json` 後跑一次 `pnpm install`（或 `npm install`）讓它自動同步 |
| `README.md`（第 1 行） | `# Bookkeeping App` → `# Piggy App` |
| `README.md`（第 132 行） | 貢獻說明段落裡提到的 "Bookkeeping App" → "Piggy App" |
| `src/app/layout.tsx`（第 15-16 行） | metadata 的 `title: "Bookkeeping"` → `"Piggy"`；`description: "A simple bookkeeping app"` → `"A simple piggy app"` |
| `src/app/client-layout.tsx`（第 27 行） | `alt="piggy-bookkeeping-icon"` → `alt="piggy-icon"`（純粹是裝飾用文字） |

## 非必要、但可以順便處理（要先跟使用者確認過才動手）

- `public/site.webmanifest`：`name`/`short_name` 目前都是空字串（本來就沒被設成 "Bookkeeping" 過），嚴格來說不算是改名的範圍——但如果想順便幫 PWA 補上名稱，可以在這裡設成 `"name": "Piggy"`、`"short_name": "Piggy"`。

## 不在程式碼裡、不屬於這次實作範圍的部分

- GitHub 的 remote 目前指向 `github.com/DanielHsieh0618/bookkeeping.git`。要把 GitHub 上的 repo 名稱也改掉的話，需要到 github.com 上操作（repo settings → rename），這是會影響共用狀態、而且不容易復原的動作，動手前要先跟使用者確認。改完之後本機還要跑 `git remote set-url origin <new-url>` 才能對上新網址。
- Vercel 專案在 dashboard 上顯示的名稱，跟這個 repo 裡的檔案完全無關（`.vercel/project.json` 裡只有 `projectId`/`orgId`，沒有名稱欄位）——如果也想改，那是 Vercel dashboard 上的操作，不是程式碼的變更。

## 驗證方式

- 跑 `grep -rniI "bookkeeping" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=out .` 應該要找不到任何結果（lockfile 部分等 `pnpm install`／`npm install` 跑過自動同步後就會乾淨）。
- 跑 `pnpm run dev`（或還沒切換 pnpm 的話是 `npm run dev`），確認瀏覽器分頁標題跟頁面 metadata 顯示的是 "Piggy"。

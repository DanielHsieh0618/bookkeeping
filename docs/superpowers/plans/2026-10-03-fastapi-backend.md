# Backend 換成 FastAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/backend` 從 Django + DRF 換成 FastAPI + raw SQL（psycopg 3），對外的 API 行為不變，`apps/frontend` 不需要修改。

**Architecture:** `app/main.py` 建立 FastAPI app，在 lifespan 裡開啟 `AsyncConnectionPool` 並套用 `schema.sql`。每個 request 透過 `Depends(get_conn)` 取得一條連線（一個 request 一個交易）。驗證與授權寫成 dependency（`app/auth.py`、`app/deps.py`），SQL 全部放在 `app/services.py`，router 只負責把 HTTP 接到 service。

**Tech Stack:** FastAPI、`uvicorn[standard]`、`psycopg[binary,pool]`、`pydantic-settings`、PyJWT、`python-dateutil`、pytest + `httpx2`（`TestClient` 需要；新版 Starlette 已不建議用 `httpx`）、uv、Docker／docker-compose。

**Spec:** [docs/superpowers/specs/2026-10-03-fastapi-backend-design.md](../specs/2026-10-03-fastapi-backend-design.md)

## Global Constraints

- 所有工作在 branch `fastapi-backend` 上進行，`main` 保留 Django 版本，全部驗證完才合併。
- `apps/frontend` 不修改。URL 路徑、JSON 欄位名稱（request 是 camelCase，response 是 snake_case）、`Authorization: Bearer` 與 `x-internal-secret` 維持原樣。
- SQL 只能出現在 `app/services.py`（以及 `schema.sql`、測試的 helper），一律用 `%s` 參數化查詢，不做字串拼接。
- `INSERT` 一律明確帶入 `uuid` 與 `description`，因為 Django 建立的舊表在這兩個欄位上沒有資料庫層級的 default。
- 不可以清除 `pgdata` volume，本機既有資料要保留。可以刪除的只有 `backend_venv` volume。
- 測試只能對名稱以 `_test` 結尾的資料庫執行。
- 跑測試前 Postgres 必須在執行：`docker compose up -d postgres`。
- Commit 訊息結尾加上 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

---

## Task 1: 移除 Django，建立 FastAPI 骨架與 `/health`

**FastAPI 觀念：** lifespan（app 啟動與關閉時要做的事）、middleware、`TestClient`。

**Files:**
- Delete: `apps/backend/manage.py`、`apps/backend/config/`、`apps/backend/api/`、`apps/backend/tests/test_*.py`
- Modify: `apps/backend/pyproject.toml`、`apps/backend/uv.lock`
- Create: `apps/backend/app/__init__.py`、`app/config.py`、`app/db.py`、`app/schema.sql`、`app/main.py`、`app/routers/__init__.py`
- Test: `apps/backend/tests/helpers.py`、`tests/conftest.py`、`tests/test_health.py`

**Interfaces:**
- Produces: `get_settings() -> Settings`（欄位 `database_url`、`jwt_secret`、`internal_api_secret`、`frontend_url`）；`create_pool(database_url) -> AsyncConnectionPool`；`apply_schema(pool)`；`get_conn(request)`（dependency，產出 `AsyncConnection`，row 是 dict）；`SCHEMA_PATH`；`app`。
- Produces（測試）：fixture `db`（同步的 psycopg 連線，autocommit，row 是 dict，每個測試前清空資料表）、fixture `client`（`TestClient`）；`tests.helpers` 的 `JWT_SECRET`、`INTERNAL_SECRET`、`TEST_DATABASE_URL`、`auth_headers(sub, secret=JWT_SECRET)`、`make_user(db, google_id="g1") -> int`、`make_category(db, user_id) -> int`、`make_record(db, user_id, category_id, description="coffee") -> int`。

- [ ] **Step 1: 移除 Django 程式碼與套件，裝上 FastAPI**

```bash
cd apps/backend
git rm -r -q manage.py config api tests/test_authentication.py tests/test_models.py tests/test_permissions.py tests/test_services.py tests/test_views_categories.py tests/test_views_internal.py tests/test_views_records.py tests/test_views_user_info.py tests/test_wait_for_db.py
uv remove django djangorestframework django-cors-headers dj-database-url gunicorn
uv remove --dev pytest-django
uv add fastapi "uvicorn[standard]" "psycopg[binary,pool]" pydantic-settings
uv add --dev httpx2
cd ../..
```

- [ ] **Step 2: 把 `apps/backend/pyproject.toml` 的 `[tool.pytest.ini_options]` 換成：**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

（拿掉 `DJANGO_SETTINGS_MODULE` 與 `python_files`。`pythonpath = ["."]` 讓測試可以 `import app` 與 `import tests.helpers`。）

- [ ] **Step 3: 建立 `apps/backend/tests/helpers.py`**

```python
import os

import jwt

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/bookkeeping_test"
)
JWT_SECRET = "test-jwt-secret-at-least-32-bytes-long"
INTERNAL_SECRET = "test-internal-secret"


def auth_headers(sub: str, secret: str = JWT_SECRET) -> dict[str, str]:
    token = jwt.encode({"sub": sub}, secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def make_user(db, google_id: str = "g1") -> int:
    row = db.execute(
        "INSERT INTO users (google_id, email, user_name, uuid) VALUES (%s, %s, %s, %s) RETURNING user_id",
        (google_id, "a@b.com", "A", "00000000-0000-0000-0000-000000000000"),
    ).fetchone()
    return row["user_id"]


def make_category(db, user_id: int) -> int:
    row = db.execute(
        "INSERT INTO categories (user_id, category_name, category_icon) VALUES (%s, %s, %s) RETURNING category_id",
        (user_id, "Food", "apple"),
    ).fetchone()
    return row["category_id"]


def make_record(db, user_id: int, category_id: int, description: str = "coffee") -> int:
    row = db.execute(
        "INSERT INTO records (record_date, record_type, amount, category_id, user_id, description)"
        " VALUES (%s, %s, %s, %s, %s, %s) RETURNING record_id",
        ("Mon Jan 5 2026", "expenses", "12.50", category_id, user_id, description),
    ).fetchone()
    return row["record_id"]
```

- [ ] **Step 4: 建立 `apps/backend/tests/conftest.py`**

```python
import os

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from psycopg.rows import dict_row

from tests.helpers import INTERNAL_SECRET, JWT_SECRET, TEST_DATABASE_URL

# Settings are read from the environment when app.main is imported, so set them first.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["JWT_SECRET"] = JWT_SECRET
os.environ["INTERNAL_API_SECRET"] = INTERNAL_SECRET

from fastapi.testclient import TestClient  # noqa: E402

from app.db import SCHEMA_PATH  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def test_database() -> None:
    dbname = conninfo_to_dict(TEST_DATABASE_URL)["dbname"]
    if not dbname.endswith("_test"):
        raise RuntimeError(f"Refusing to run tests against non-test database {dbname!r}")
    with psycopg.connect(make_conninfo(TEST_DATABASE_URL, dbname="postgres"), autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,)).fetchone()
        if not exists:
            conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(dbname)))
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute(SCHEMA_PATH.read_text())


@pytest.fixture
def db(test_database):
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True, row_factory=dict_row) as conn:
        conn.execute("TRUNCATE records, categories, users RESTART IDENTITY CASCADE")
        yield conn


@pytest.fixture
def client(db):
    with TestClient(app) as test_client:
        yield test_client
```

`with TestClient(app)` 會執行 lifespan，所以每個測試都會真的開一次 pool。

- [ ] **Step 5: 寫會失敗的測試 `apps/backend/tests/test_health.py`**

```python
def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_the_frontend_origin(client):
    response = client.options(
        "/health",
        headers={"Origin": "https://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers["access-control-allow-origin"] == "https://localhost:3000"
```

- [ ] **Step 6: 執行測試，確認失敗**

```bash
docker compose up -d postgres
cd apps/backend && uv run pytest; cd ../..
```

Expected: FAIL，`ModuleNotFoundError: No module named 'app'`。

- [ ] **Step 7: 建立 `apps/backend/app/__init__.py` 與 `apps/backend/app/routers/__init__.py`**（兩個都是空檔案）

- [ ] **Step 8: 建立 `apps/backend/app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/bookkeeping"
    jwt_secret: str = "dev-jwt-secret"
    internal_api_secret: str = "dev-internal-secret"
    frontend_url: str = "https://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`BaseSettings` 會用不分大小寫的環境變數名稱（`DATABASE_URL` → `database_url`）覆蓋預設值。預設值只是本機開發用，部署時一定要設定真正的值。

- [ ] **Step 9: 建立 `apps/backend/app/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS users (
    user_id   INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    google_id VARCHAR(255) NOT NULL UNIQUE,
    email     VARCHAR(254) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    uuid      VARCHAR(36)  NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    category_id   INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users (user_id),
    category_name VARCHAR(255) NOT NULL,
    category_icon VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
    record_id   INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    record_date VARCHAR(64) NOT NULL,
    record_type VARCHAR(32) NOT NULL,
    amount      NUMERIC(12, 2) NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories (category_id),
    user_id     INTEGER NOT NULL REFERENCES users (user_id),
    description TEXT NOT NULL
);
```

欄位定義與 Django migration `0001_initial` 建立的表一致。

- [ ] **Step 10: 建立 `apps/backend/app/db.py`**

```python
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import Request
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def create_pool(database_url: str) -> AsyncConnectionPool:
    return AsyncConnectionPool(
        database_url,
        min_size=1,
        max_size=5,
        open=False,
        kwargs={"row_factory": dict_row},
    )


async def apply_schema(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn:
        await conn.execute(SCHEMA_PATH.read_text())


async def get_conn(request: Request) -> AsyncIterator[AsyncConnection]:
    async with request.app.state.pool.connection() as conn:
        yield conn
```

`pool.connection()` 離開時會自動 commit，有例外時 rollback，所以一個 request 就是一個交易。

- [ ] **Step 11: 建立 `apps/backend/app/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import apply_schema, create_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = create_pool(get_settings().database_url)
    try:
        await pool.open(wait=True, timeout=30)
        await apply_schema(pool)
        app.state.pool = pool
        yield
    finally:
        await pool.close()


app = FastAPI(title="Bookkeeping API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

`pool.open(wait=True, timeout=30)` 會等到資料庫真的可以連線，取代原本的 `wait_for_db`。

- [ ] **Step 12: 執行測試，確認通過**

```bash
cd apps/backend && uv run pytest -v; cd ../..
```

Expected: PASS（2 tests）。資料庫 `bookkeeping_test` 會在第一次執行時自動建立。

- [ ] **Step 13: Commit**

```bash
git add -A apps/backend
git commit -m "feat(backend): replace the Django project with a FastAPI skeleton"
```

---

## Task 2: JWT 驗證與 `GET /userInfo`

**FastAPI 觀念：** `Depends`、`Annotated` 型別別名、`HTTPBearer`（讓 `/docs` 出現 Authorize 按鈕）、`response_model`、`APIRouter`。

**Files:**
- Create: `apps/backend/app/auth.py`、`app/deps.py`、`app/schemas.py`、`app/services.py`、`app/routers/users.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_auth.py`、`tests/test_user_info.py`

**Interfaces:**
- Consumes: `get_settings`、`Settings`、`get_conn`（Task 1）
- Produces: `get_current_google_id(...) -> str`、`SettingsDep`（`app/auth.py`）；`CurrentGoogleId`、`Conn`（`app/deps.py`）；`UserOut`（`app/schemas.py`）；`services.get_user_by_google_id(conn, google_id) -> dict | None`

- [ ] **Step 1: 寫會失敗的測試**

```python
# apps/backend/tests/test_auth.py
import jwt

from tests.helpers import JWT_SECRET, auth_headers


def test_missing_token_is_401_with_bearer_challenge(client):
    response = client.get("/userInfo")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_malformed_token_is_401(client):
    response = client.get("/userInfo", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_token_signed_with_another_secret_is_401(client):
    headers = auth_headers("g1", secret="some-other-secret-at-least-32-bytes-long")
    response = client.get("/userInfo", headers=headers)
    assert response.status_code == 401


def test_token_without_sub_is_401(client):
    token = jwt.encode({"name": "nobody"}, JWT_SECRET, algorithm="HS256")
    response = client.get("/userInfo", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401
```

```python
# apps/backend/tests/test_user_info.py
from tests.helpers import auth_headers, make_user


def test_returns_404_when_no_matching_user(client):
    response = client.get("/userInfo", headers=auth_headers("g1"))
    assert response.status_code == 404


def test_returns_the_user_row_for_the_jwt_subject(client, db):
    user_id = make_user(db, "g1")
    response = client.get("/userInfo", headers=auth_headers("g1"))
    assert response.status_code == 200
    assert response.json() == {
        "user_id": user_id,
        "google_id": "g1",
        "email": "a@b.com",
        "user_name": "A",
        "uuid": "00000000-0000-0000-0000-000000000000",
    }
```

- [ ] **Step 2: 執行測試，確認失敗**

```bash
cd apps/backend && uv run pytest tests/test_auth.py tests/test_user_info.py; cd ../..
```

Expected: FAIL，全部都拿到 404（路由 `/userInfo` 還不存在）。

- [ ] **Step 3: 建立 `apps/backend/app/auth.py`**

```python
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

SettingsDep = Annotated[Settings, Depends(get_settings)]

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_google_id(
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    if credentials is None:
        raise _unauthorized("Authentication credentials were not provided.")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid token") from exc
    sub = payload.get("sub")
    if not sub:
        raise _unauthorized("Invalid token")
    return sub
```

`HTTPBearer(auto_error=False)` 在沒有 header 時回傳 `None` 而不是自己丟錯，這樣 401 的內容由我們決定。

- [ ] **Step 4: 建立 `apps/backend/app/deps.py`**

```python
from typing import Annotated

from fastapi import Depends
from psycopg import AsyncConnection

from .auth import get_current_google_id
from .db import get_conn

CurrentGoogleId = Annotated[str, Depends(get_current_google_id)]
# scope="function" commits before the response is sent, so a failed commit is a 500, never a false 200.
Conn = Annotated[AsyncConnection, Depends(get_conn, scope="function")]
```

Gotcha：`yield` dependency 預設（`scope="request"`）是在 response 送出**之後**才執行收尾。`get_conn` 的收尾就是 commit，所以不加 `scope="function"` 的話，commit 失敗時 client 已經拿到 200。這個問題在實作後實際遇到過（Django 建立的 foreign key 是 `DEFERRABLE INITIALLY DEFERRED`，違反時要到 commit 才報錯），由 `tests/test_transactions.py` 把關。

- [ ] **Step 5: 建立 `apps/backend/app/schemas.py`**

```python
from pydantic import BaseModel


class UserOut(BaseModel):
    user_id: int
    google_id: str
    email: str
    user_name: str
    uuid: str
```

- [ ] **Step 6: 建立 `apps/backend/app/services.py`**

```python
from psycopg import AsyncConnection


async def get_user_by_google_id(conn: AsyncConnection, google_id: str) -> dict | None:
    cur = await conn.execute(
        "SELECT user_id, google_id, email, user_name, uuid FROM users WHERE google_id = %s",
        (google_id,),
    )
    return await cur.fetchone()
```

- [ ] **Step 7: 建立 `apps/backend/app/routers/users.py`**

```python
from fastapi import APIRouter, HTTPException, status

from .. import services
from ..deps import Conn, CurrentGoogleId
from ..schemas import UserOut

router = APIRouter(tags=["users"])


@router.get("/userInfo", response_model=UserOut)
async def user_info(google_id: CurrentGoogleId, conn: Conn):
    user = await services.get_user_by_google_id(conn, google_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user
```

- [ ] **Step 8: 在 `apps/backend/app/main.py` 掛上 router**

把 import 改成：

```python
from .config import get_settings
from .db import apply_schema, create_pool
from .routers import users
```

並在 `app.add_middleware(...)` 之後、`@app.get("/health")` 之前加上：

```python
app.include_router(users.router)
```

- [ ] **Step 9: 執行測試，確認通過**

```bash
cd apps/backend && uv run pytest -v; cd ../..
```

Expected: PASS（8 tests）。

- [ ] **Step 10: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add JWT auth dependency and GET /userInfo"
```

---

## Task 3: `POST /internal/users/bootstrap`

**FastAPI 觀念：** 用 Pydantic model 當 request body、router 層級的 `dependencies`。

**Files:**
- Modify: `apps/backend/app/auth.py`、`app/schemas.py`、`app/services.py`、`app/main.py`
- Create: `apps/backend/app/routers/internal.py`
- Test: `apps/backend/tests/test_internal.py`

**Interfaces:**
- Consumes: `SettingsDep`（Task 2）、`Conn`（Task 2）
- Produces: `require_internal_secret(...) -> None`；`BootstrapUser`、`Message`；`services.bootstrap_user(conn, *, google_id, email, user_name) -> None`

- [ ] **Step 1: 寫會失敗的測試 `apps/backend/tests/test_internal.py`**

```python
from tests.helpers import INTERNAL_SECRET

BODY = {"googleId": "g1", "email": "a@b.com", "userName": "A"}
HEADERS = {"x-internal-secret": INTERNAL_SECRET}


def test_rejects_without_internal_secret(client):
    response = client.post("/internal/users/bootstrap", json=BODY)
    assert response.status_code == 403


def test_rejects_wrong_internal_secret(client):
    response = client.post("/internal/users/bootstrap", json=BODY, headers={"x-internal-secret": "wrong"})
    assert response.status_code == 403


def test_bootstraps_a_new_user_with_a_default_category(client, db):
    response = client.post("/internal/users/bootstrap", json=BODY, headers=HEADERS)
    assert response.status_code == 200
    assert response.json() == {"message": "ok"}
    user = db.execute("SELECT * FROM users WHERE google_id = 'g1'").fetchone()
    assert user["email"] == "a@b.com"
    assert user["user_name"] == "A"
    assert len(user["uuid"]) == 36
    categories = db.execute("SELECT * FROM categories WHERE user_id = %s", (user["user_id"],)).fetchall()
    assert [(c["category_name"], c["category_icon"]) for c in categories] == [("Food", "apple")]


def test_bootstrap_is_idempotent(client, db):
    client.post("/internal/users/bootstrap", json=BODY, headers=HEADERS)
    response = client.post("/internal/users/bootstrap", json=BODY, headers=HEADERS)
    assert response.status_code == 200
    assert db.execute("SELECT count(*) AS n FROM users").fetchone()["n"] == 1
    assert db.execute("SELECT count(*) AS n FROM categories").fetchone()["n"] == 1


def test_missing_fields_are_422(client):
    response = client.post("/internal/users/bootstrap", json={"googleId": "g1"}, headers=HEADERS)
    assert response.status_code == 422
```

- [ ] **Step 2: 執行測試，確認失敗**

```bash
cd apps/backend && uv run pytest tests/test_internal.py; cd ../..
```

Expected: FAIL，全部拿到 404。

- [ ] **Step 3: 在 `apps/backend/app/auth.py` 加上 internal secret 檢查**

在檔案最上方加上 `import secrets`，把 fastapi 的 import 改成 `from fastapi import Depends, Header, HTTPException, status`，並在檔案最後加上：

```python
async def require_internal_secret(
    settings: SettingsDep,
    x_internal_secret: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.internal_api_secret.encode()
    if x_internal_secret is None or not secrets.compare_digest(x_internal_secret.encode(), expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
```

參數名稱 `x_internal_secret` 會自動對應到 header `x-internal-secret`。

- [ ] **Step 4: 在 `apps/backend/app/schemas.py` 最後加上：**

```python
class BootstrapUser(BaseModel):
    googleId: str
    email: str
    userName: str


class Message(BaseModel):
    message: str
```

- [ ] **Step 5: 在 `apps/backend/app/services.py` 加上 `bootstrap_user`**

在檔案最上方加上 `import uuid`，並在檔案最後加上：

```python
async def bootstrap_user(conn: AsyncConnection, *, google_id: str, email: str, user_name: str) -> None:
    cur = await conn.execute(
        "INSERT INTO users (google_id, email, user_name, uuid) VALUES (%s, %s, %s, %s)"
        " ON CONFLICT (google_id) DO NOTHING RETURNING user_id",
        (google_id, email, user_name, str(uuid.uuid4())),
    )
    created = await cur.fetchone()
    if created is None:
        return
    await conn.execute(
        "INSERT INTO categories (user_id, category_name, category_icon) VALUES (%s, %s, %s)",
        (created["user_id"], "Food", "apple"),
    )
```

使用者已存在時 `ON CONFLICT DO NOTHING` 不會回傳任何 row，所以不會重複建立預設分類。

- [ ] **Step 6: 建立 `apps/backend/app/routers/internal.py`**

```python
from fastapi import APIRouter, Depends

from .. import services
from ..auth import require_internal_secret
from ..deps import Conn
from ..schemas import BootstrapUser, Message

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(require_internal_secret)],
)


@router.post("/users/bootstrap", response_model=Message)
async def bootstrap(body: BootstrapUser, conn: Conn):
    await services.bootstrap_user(conn, google_id=body.googleId, email=body.email, user_name=body.userName)
    return {"message": "ok"}
```

- [ ] **Step 7: 在 `apps/backend/app/main.py` 掛上 router**

把 `from .routers import users` 改成 `from .routers import internal, users`，並在 `app.include_router(users.router)` 之後加上：

```python
app.include_router(internal.router)
```

- [ ] **Step 8: 執行測試，確認通過**

```bash
cd apps/backend && uv run pytest -v; cd ../..
```

Expected: PASS（13 tests）。

- [ ] **Step 9: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add POST /internal/users/bootstrap"
```

---

## Task 4: `GET /users/{user_google_id}/categories`

**FastAPI 觀念：** dependency 可以讀 path 參數，也可以依賴其他 dependency（dependency 鏈）。

**Files:**
- Modify: `apps/backend/app/auth.py`、`app/deps.py`、`app/schemas.py`、`app/services.py`、`app/main.py`
- Create: `apps/backend/app/routers/categories.py`
- Test: `apps/backend/tests/test_categories.py`

**Interfaces:**
- Consumes: `get_current_google_id`、`Conn`（Task 2）
- Produces: `require_owner(user_google_id, google_id) -> str`；`OwnerUserId`（dependency 型別別名，值是 path 上那位使用者的 `user_id`，不符回 403、找不到回 404）；`CategoryOut`；`services.get_user_id_by_google_id(conn, google_id) -> int | None`、`services.list_categories(conn, user_id) -> list[dict]`

- [ ] **Step 1: 寫會失敗的測試 `apps/backend/tests/test_categories.py`**

```python
from tests.helpers import auth_headers, make_category, make_user


def test_requires_authentication(client):
    response = client.get("/users/g1/categories")
    assert response.status_code == 401


def test_forbids_mismatched_google_id(client):
    response = client.get("/users/someone-else/categories", headers=auth_headers("g1"))
    assert response.status_code == 403


def test_returns_404_for_unknown_user(client):
    response = client.get("/users/g1/categories", headers=auth_headers("g1"))
    assert response.status_code == 404


def test_returns_only_the_users_categories(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    make_category(db, make_user(db, "g2"))
    response = client.get("/users/g1/categories", headers=auth_headers("g1"))
    assert response.status_code == 200
    assert response.json() == [
        {"category_id": category_id, "user_id": user_id, "category_name": "Food", "category_icon": "apple"}
    ]
```

- [ ] **Step 2: 執行測試，確認失敗**

```bash
cd apps/backend && uv run pytest tests/test_categories.py; cd ../..
```

Expected: FAIL，全部拿到 404（其中 `test_returns_404_for_unknown_user` 會碰巧通過）。

- [ ] **Step 3: 在 `apps/backend/app/auth.py` 的 `get_current_google_id` 之後加上：**

```python
async def require_owner(
    user_google_id: str,
    google_id: Annotated[str, Depends(get_current_google_id)],
) -> str:
    if user_google_id != google_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return google_id
```

- [ ] **Step 4: 在 `apps/backend/app/services.py` 最後加上：**

```python
async def get_user_id_by_google_id(conn: AsyncConnection, google_id: str) -> int | None:
    cur = await conn.execute("SELECT user_id FROM users WHERE google_id = %s", (google_id,))
    row = await cur.fetchone()
    return row["user_id"] if row else None


async def list_categories(conn: AsyncConnection, user_id: int) -> list[dict]:
    cur = await conn.execute(
        "SELECT category_id, user_id, category_name, category_icon FROM categories"
        " WHERE user_id = %s ORDER BY category_id",
        (user_id,),
    )
    return await cur.fetchall()
```

- [ ] **Step 5: 把 `apps/backend/app/deps.py` 整個換成：**

```python
from typing import Annotated

from fastapi import Depends, HTTPException, status
from psycopg import AsyncConnection

from . import services
from .auth import get_current_google_id, require_owner
from .db import get_conn

CurrentGoogleId = Annotated[str, Depends(get_current_google_id)]
# scope="function" commits before the response is sent, so a failed commit is a 500, never a false 200.
Conn = Annotated[AsyncConnection, Depends(get_conn, scope="function")]


async def get_owner_user_id(google_id: Annotated[str, Depends(require_owner)], conn: Conn) -> int:
    user_id = await services.get_user_id_by_google_id(conn, google_id)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_id


OwnerUserId = Annotated[int, Depends(get_owner_user_id)]
```

同一個 request 裡 `get_conn` 只會執行一次，所以 `get_owner_user_id` 和 endpoint 拿到的是同一條連線。

- [ ] **Step 6: 在 `apps/backend/app/schemas.py` 的 `UserOut` 之後加上：**

```python
class CategoryOut(BaseModel):
    category_id: int
    user_id: int
    category_name: str
    category_icon: str
```

- [ ] **Step 7: 建立 `apps/backend/app/routers/categories.py`**

```python
from fastapi import APIRouter

from .. import services
from ..deps import Conn, OwnerUserId
from ..schemas import CategoryOut

router = APIRouter(tags=["categories"])


@router.get("/users/{user_google_id}/categories", response_model=list[CategoryOut])
async def list_user_categories(user_id: OwnerUserId, conn: Conn):
    return await services.list_categories(conn, user_id)
```

- [ ] **Step 8: 在 `apps/backend/app/main.py` 掛上 router**

把 routers 的 import 改成 `from .routers import categories, internal, users`，並在 `app.include_router(internal.router)` 之後加上：

```python
app.include_router(categories.router)
```

- [ ] **Step 9: 執行測試，確認通過**

```bash
cd apps/backend && uv run pytest -v; cd ../..
```

Expected: PASS（17 tests）。

- [ ] **Step 10: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add GET /users/{user_google_id}/categories"
```

---

## Task 5: Records 路由

**FastAPI 觀念：** `field_validator`（驗證並轉換輸入）、model 繼承、decorator 上的 `dependencies`。

**Files:**
- Modify: `apps/backend/app/schemas.py`、`app/services.py`、`app/main.py`
- Create: `apps/backend/app/routers/records.py`
- Test: `apps/backend/tests/test_records.py`、`tests/test_schemas.py`

**Interfaces:**
- Consumes: `OwnerUserId`、`Conn`（Task 4）、`get_current_google_id`（Task 2）、`Message`（Task 3）
- Produces: `to_date_string(value: str) -> str`、`RecordOut`、`RecordCreate`、`GlobalRecordCreate`；`services.list_records(conn, user_id=None) -> list[dict]`、`services.create_record(conn, *, record_date, record_type, amount, category_id, user_id, description) -> None`

- [ ] **Step 1: 寫會失敗的測試**

```python
# apps/backend/tests/test_schemas.py
import pytest

from app.schemas import to_date_string


@pytest.mark.parametrize(
    "value,expected",
    [
        ("2026-01-05", "Mon Jan 5 2026"),
        ("Mon Jan 5 2026", "Mon Jan 5 2026"),
    ],
)
def test_to_date_string_matches_js_todatestring_format(value, expected):
    assert to_date_string(value) == expected
```

```python
# apps/backend/tests/test_records.py
from decimal import Decimal

from tests.helpers import auth_headers, make_category, make_record, make_user


def test_user_records_requires_authentication(client):
    response = client.get("/users/g1/records")
    assert response.status_code == 401


def test_user_records_forbids_mismatched_google_id(client):
    response = client.get("/users/someone-else/records", headers=auth_headers("g1"))
    assert response.status_code == 403


def test_user_records_returns_only_the_users_records(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    record_id = make_record(db, user_id, category_id)
    other_id = make_user(db, "g2")
    make_record(db, other_id, make_category(db, other_id), description="not mine")
    response = client.get("/users/g1/records", headers=auth_headers("g1"))
    assert response.status_code == 200
    assert response.json() == [
        {
            "record_id": record_id,
            "record_date": "Mon Jan 5 2026",
            "record_type": "expenses",
            "amount": 12.5,
            "category_id": category_id,
            "user_id": user_id,
            "description": "coffee",
        }
    ]


def test_user_records_post_resolves_user_id_server_side(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    response = client.post(
        "/users/g1/records",
        json={
            "recordDate": "2026-01-05",
            "recordType": "expenses",
            "amount": 10.5,
            "categoryId": category_id,
            "description": "tea",
        },
        headers=auth_headers("g1"),
    )
    assert response.status_code == 200
    assert response.json() == {"message": "Success"}
    record = db.execute("SELECT * FROM records").fetchone()
    assert record["user_id"] == user_id
    assert record["record_date"] == "Mon Jan 5 2026"
    assert record["amount"] == Decimal("10.50")
    assert record["description"] == "tea"


def test_user_records_post_defaults_description_to_empty(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    response = client.post(
        "/users/g1/records",
        json={"recordDate": "2026-01-05", "recordType": "income", "amount": 1, "categoryId": category_id},
        headers=auth_headers("g1"),
    )
    assert response.status_code == 200
    assert db.execute("SELECT description FROM records").fetchone()["description"] == ""


def test_user_records_post_rejects_unparseable_date(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    response = client.post(
        "/users/g1/records",
        json={"recordDate": "not a date", "recordType": "expenses", "amount": 1, "categoryId": category_id},
        headers=auth_headers("g1"),
    )
    assert response.status_code == 422
    assert db.execute("SELECT count(*) AS n FROM records").fetchone()["n"] == 0


def test_global_records_rejects_with_no_token(client):
    response = client.get("/records")
    assert response.status_code == 401


def test_global_records_returns_everything(client, db):
    assert client.get("/records", headers=auth_headers("g1")).json() == []
    user_id = make_user(db, "g2")
    make_record(db, user_id, make_category(db, user_id))
    response = client.get("/records", headers=auth_headers("g1"))
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_global_records_post_uses_userid_from_body(client, db):
    user_id = make_user(db, "g1")
    category_id = make_category(db, user_id)
    response = client.post(
        "/records",
        json={
            "recordDate": "2026-01-05",
            "recordType": "income",
            "amount": 100,
            "categoryId": category_id,
            "userId": user_id,
            "description": "salary",
        },
        headers=auth_headers("g1"),
    )
    assert response.status_code == 200
    assert db.execute("SELECT user_id FROM records").fetchone()["user_id"] == user_id
```

- [ ] **Step 2: 執行測試，確認失敗**

```bash
cd apps/backend && uv run pytest tests/test_records.py tests/test_schemas.py; cd ../..
```

Expected: FAIL，`ImportError: cannot import name 'to_date_string' from 'app.schemas'`，records 的測試拿到 404。

- [ ] **Step 3: 把 `apps/backend/app/schemas.py` 整個換成：**

```python
from decimal import Decimal
from typing import Annotated

from dateutil import parser as date_parser
from pydantic import BaseModel, Field, field_validator


def to_date_string(value: str) -> str:
    dt = date_parser.parse(value)
    return f"{dt.strftime('%a %b')} {dt.day} {dt.year}"


class UserOut(BaseModel):
    user_id: int
    google_id: str
    email: str
    user_name: str
    uuid: str


class CategoryOut(BaseModel):
    category_id: int
    user_id: int
    category_name: str
    category_icon: str


class RecordOut(BaseModel):
    record_id: int
    record_date: str
    record_type: str
    amount: float
    category_id: int
    user_id: int
    description: str


class RecordCreate(BaseModel):
    recordDate: str
    recordType: str
    amount: Annotated[Decimal, Field(max_digits=12, decimal_places=2)]
    categoryId: int
    description: str = ""

    @field_validator("recordDate")
    @classmethod
    def normalize_record_date(cls, value: str) -> str:
        return to_date_string(value)


class GlobalRecordCreate(RecordCreate):
    userId: int


class BootstrapUser(BaseModel):
    googleId: str
    email: str
    userName: str


class Message(BaseModel):
    message: str
```

`to_date_string` 的輸出格式對應 JS 的 `new Date(x).toDateString()`（`"Www Mmm d yyyy"`，日期不補零）。`dateutil` 解析失敗會丟 `ValueError` 的子類別，Pydantic 會把它轉成 422。`RecordOut.amount` 宣告成 `float`，所以資料庫的 `NUMERIC` 會以 JSON 數字輸出。

- [ ] **Step 4: 在 `apps/backend/app/services.py` 加上 records 的 SQL**

在檔案最上方加上 `from decimal import Decimal`，並在檔案最後加上：

```python
async def list_records(conn: AsyncConnection, user_id: int | None = None) -> list[dict]:
    if user_id is None:
        cur = await conn.execute(
            "SELECT record_id, record_date, record_type, amount, category_id, user_id, description"
            " FROM records ORDER BY record_id"
        )
    else:
        cur = await conn.execute(
            "SELECT record_id, record_date, record_type, amount, category_id, user_id, description"
            " FROM records WHERE user_id = %s ORDER BY record_id",
            (user_id,),
        )
    return await cur.fetchall()


async def create_record(
    conn: AsyncConnection,
    *,
    record_date: str,
    record_type: str,
    amount: Decimal,
    category_id: int,
    user_id: int,
    description: str,
) -> None:
    await conn.execute(
        "INSERT INTO records (record_date, record_type, amount, category_id, user_id, description)"
        " VALUES (%s, %s, %s, %s, %s, %s)",
        (record_date, record_type, amount, category_id, user_id, description),
    )
```

- [ ] **Step 5: 建立 `apps/backend/app/routers/records.py`**

```python
from fastapi import APIRouter, Depends

from .. import services
from ..auth import get_current_google_id
from ..deps import Conn, OwnerUserId
from ..schemas import GlobalRecordCreate, Message, RecordCreate, RecordOut

router = APIRouter(tags=["records"])


@router.get("/users/{user_google_id}/records", response_model=list[RecordOut])
async def list_user_records(user_id: OwnerUserId, conn: Conn):
    return await services.list_records(conn, user_id)


@router.post("/users/{user_google_id}/records", response_model=Message)
async def create_user_record(body: RecordCreate, user_id: OwnerUserId, conn: Conn):
    await services.create_record(
        conn,
        record_date=body.recordDate,
        record_type=body.recordType,
        amount=body.amount,
        category_id=body.categoryId,
        user_id=user_id,
        description=body.description,
    )
    return {"message": "Success"}


@router.get("/records", response_model=list[RecordOut], dependencies=[Depends(get_current_google_id)])
async def list_all_records(conn: Conn):
    return await services.list_records(conn)


@router.post("/records", response_model=Message, dependencies=[Depends(get_current_google_id)])
async def create_record(body: GlobalRecordCreate, conn: Conn):
    await services.create_record(
        conn,
        record_date=body.recordDate,
        record_type=body.recordType,
        amount=body.amount,
        category_id=body.categoryId,
        user_id=body.userId,
        description=body.description,
    )
    return {"message": "Success"}
```

- [ ] **Step 6: 在 `apps/backend/app/main.py` 掛上 router**

把 routers 的 import 改成 `from .routers import categories, internal, records, users`，並在 `app.include_router(categories.router)` 之後加上：

```python
app.include_router(records.router)
```

- [ ] **Step 7: 執行測試，確認通過**

```bash
cd apps/backend && uv run pytest -v; cd ../..
```

Expected: PASS（28 tests）。

- [ ] **Step 8: Commit**

```bash
git add apps/backend
git commit -m "feat(backend): add /records and /users/{user_google_id}/records"
```

---

## Task 6: Docker、docker-compose、本機啟動 script

**Files:**
- Modify: `apps/backend/Dockerfile`、`apps/backend/.env.example`、`docker-compose.yml`、root `package.json`
- Delete: `apps/backend/docker-entrypoint.sh`

**Interfaces:** 無，純粹是執行環境。

- [ ] **Step 1: 把 `apps/backend/Dockerfile` 整個換成：**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
EXPOSE 4000
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
```

- [ ] **Step 2: 刪除 entrypoint script**

```bash
git rm -q apps/backend/docker-entrypoint.sh
```

- [ ] **Step 3: 把 `apps/backend/.env.example` 整個換成：**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookkeeping
JWT_SECRET=
INTERNAL_API_SECRET=
FRONTEND_URL=https://localhost:3000
```

- [ ] **Step 4: 修改 `docker-compose.yml` 的 `backend` service**

把 `command:` 那一行換成：

```yaml
    command: ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000", "--reload", "--ssl-certfile=certificates/localhost.pem", "--ssl-keyfile=certificates/localhost-key.pem"]
```

並刪除 `environment:` 底下的 `DJANGO_SECRET_KEY: dev-django-secret-key` 這一行。

- [ ] **Step 5: 修改 root `package.json` 的 `dev:backend`**

```json
    "dev:backend": "uv run --directory apps/backend uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload --ssl-certfile=certificates/localhost.pem --ssl-keyfile=certificates/localhost-key.pem",
```

- [ ] **Step 6: 重建 backend，只刪除舊的 venv volume**

```bash
docker compose down
docker volume rm bookkeeping_backend_venv
docker compose up --build -d
docker compose logs backend
curl -sk https://localhost:4000/health
```

Expected: log 出現 `Uvicorn running on https://0.0.0.0:4000` 與 `Application startup complete.`；`curl` 回 `{"status":"ok"}`。**不要**加 `-v`，那會連 `pgdata` 一起刪掉。

- [ ] **Step 7: 確認既有資料還在、auth 正常**

```bash
docker compose exec postgres psql -U postgres -d bookkeeping -c "SELECT count(*) FROM users;"
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:4000/userInfo
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:4000/docs
```

Expected: `users` 的筆數與換之前相同；`/userInfo` 回 `401`；`/docs` 回 `200`。

- [ ] **Step 8: 確認 host 上改程式碼會自動重載**

```bash
touch apps/backend/app/main.py
sleep 3
docker compose logs backend --tail 5
```

Expected: log 出現 `WatchFiles detected changes in 'app/main.py'. Reloading...`。

- [ ] **Step 9: 確認本機 script 可以啟動**

```bash
docker compose stop backend
pnpm run dev:backend
```

Expected: `Uvicorn running on https://0.0.0.0:4000`。另開一個終端機執行 `curl -sk https://localhost:4000/health` 回 `{"status":"ok"}`，確認後 Ctrl-C 停掉，再 `docker compose start backend`。

- [ ] **Step 10: Commit**

```bash
git add apps/backend/Dockerfile apps/backend/.env.example docker-compose.yml package.json
git commit -m "feat(backend): run the FastAPI app with uvicorn in Docker and local dev"
```

---

## Task 7: 文件更新與最終驗證

**Files:**
- Modify: `README.md`、`docs/plans/frontend-backend-split.md`、`docs/plans/frontend-backend-split-checklist.md`

- [ ] **Step 1: 更新 `README.md`**

「Getting Started」開頭的專案描述：把 `apps/backend` (Django + DRF, uv) 改成 `apps/backend` (FastAPI, uv)。

「4. Database Setup」整段換成：

```markdown
### 4. Database Setup

The backend owns the database — the frontend never talks to Postgres directly. The schema lives in `apps/backend/app/schema.sql` (`CREATE TABLE IF NOT EXISTS`) and is applied automatically every time the backend starts, so there is no separate migration step.

- Start Postgres with `docker compose up -d postgres`.
- There is no migration tool: to change the schema, edit `schema.sql` for fresh databases and apply the matching `ALTER TABLE` by hand to existing ones.
```

「5. Running the Development Server」裡把 `via gunicorn with --reload` 改成 `via uvicorn with --reload`，把 `(the entrypoint runs wait_for_db then migrate on every start)` 這類描述刪掉，並在該節最後加上一行：

```markdown
The backend serves interactive API docs at `https://localhost:4000/docs`.
```

「Tech Stack」的 Backend 項目換成：

```markdown
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) with raw SQL via [psycopg 3](https://www.psycopg.org/psycopg3/) (async connection pool) against Postgres, `PyJWT` for verifying the frontend-issued JWT, `uvicorn` as the server (dev and prod alike), managed with [uv](https://docs.astral.sh/uv/).
```

「Project Structure」的 backend 區塊換成：

```
  backend/              FastAPI app (uv project) — all DB access and business logic
    app/main.py         app, lifespan (connection pool + schema), CORS, routers
    app/routers/        HTTP endpoints
    app/services.py     all SQL
    app/auth.py         JWT and internal-secret dependencies
    app/schema.sql      table definitions, applied on startup
    tests/              pytest + TestClient against a real Postgres
    Dockerfile
```

「Deployment」的環境變數清單拿掉 `DJANGO_SECRET_KEY`。

- [ ] **Step 2: 在 `docs/plans/frontend-backend-split.md` 與 `docs/plans/frontend-backend-split-checklist.md` 的標題下方各加上一段：**

```markdown
> **2026-10-03 更新：** Backend 已由 Django + DRF 換成 FastAPI + raw SQL，設計見 [2026-10-03-fastapi-backend-design.md](../superpowers/specs/2026-10-03-fastapi-backend-design.md)。本文件中關於 Django 的內容（ORM、migration、gunicorn、`wait_for_db`）是歷史紀錄，不再反映目前的程式碼；前後端拆分、JWT 橋接、部署方式等決策仍然有效。
```

- [ ] **Step 3: 最終驗證**

```bash
cd apps/backend && uv run pytest; cd ../..
git diff main --stat -- apps/frontend
pnpm run lint
grep -rniI "django\|gunicorn\|rest_framework" apps/backend --exclude-dir=.venv --exclude=uv.lock
```

Expected: 28 tests 全過；`apps/frontend` 沒有任何差異；lint 通過；`grep` 沒有任何結果。

- [ ] **Step 4: Commit**

```bash
git add README.md docs/plans
git commit -m "docs: describe the FastAPI backend in the README and mark the Django notes as historical"
```

- [ ] **Step 5: 請使用者在瀏覽器驗證**

重啟 frontend（`pnpm run dev:frontend`），登入後確認 `/records` 能載入、`/record` 能新增一筆紀錄並顯示出來，然後由使用者決定是否把 `fastapi-backend` 合併回 `main`。

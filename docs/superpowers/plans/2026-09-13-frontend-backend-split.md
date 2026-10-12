# Frontend/Backend Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single Next.js `bookkeeping` app into `apps/frontend` (Next.js, UI + NextAuth only) and `apps/backend` (a new Django + Django REST Framework API), moving all DB access and business logic to the backend behind JWT auth.

**Architecture:** `apps/backend` is a Django project (`config/`) with one Django app (`api/`) holding models, DRF serializers, a custom JWT `authentication.BaseAuthentication` class, and thin `APIView`s. Data access goes through Django's ORM (models + migrations) instead of raw SQL. `apps/frontend` keeps NextAuth for Google OAuth and mints a short-lived JWT (`session.apiToken`) that it sends as `Authorization: Bearer` on every call to the backend's REST API.

**Tech Stack:** Django, Django REST Framework, `django-cors-headers`, `dj-database-url`, `psycopg[binary]`, `PyJWT`, `python-dateutil`, `gunicorn`, `pytest` + `pytest-django` (backend tests), `uv` (Python dependency management), `pnpm` (frontend), Docker/docker-compose, Next.js 14 (unchanged), NextAuth (unchanged).

**Spec:** [docs/plans/frontend-backend-split.md](../../plans/frontend-backend-split.md)

## Global Constraints

- `apps/frontend` (pnpm) and `apps/backend` (uv) are two fully independent projects — no shared JS/Python monorepo tooling. Root only has a thin `package.json` with `concurrently` for one-command local dev.
- Backend is Django + Django REST Framework — not Flask, not FastAPI.
- DB access goes through the Django ORM (models + migrations), not raw SQL — a deliberate departure from this project's earlier "raw SQL" convention, made because Django is built around its ORM.
- NextAuth stays in `apps/frontend`. All DB access is backend-only — the frontend never talks to Postgres directly.
- Every backend route except `/internal/*` requires a valid `Authorization: Bearer <JWT>`; `/internal/*` requires the `x-internal-secret` header instead.
- Routes scoped to a `user_google_id` path param must return 403 if it doesn't match the authenticated JWT's subject.
- Backend deploys via Docker to a separate host; frontend deployment stays on Vercel (Root Directory becomes `apps/frontend`).
- Backend tests that touch the ORM need a real reachable Postgres (pytest-django creates/destroys a throwaway test database against it via migrations) — unlike a pure-fake-injected-DB design, `docker compose up postgres` (or any local Postgres) must be running before `pytest` will pass.

---

## Task 1: Root workspace scaffold — move existing app into `apps/frontend`

**Files:**
- Create: `package.json` (new root, replaces the current one — orchestration only, not a workspace root)
- Move: everything currently at repo root (`src/`, `public/`, `certificates/`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.*`, `components.json`, `next-auth.d.ts`, `next-env.d.ts`, `.eslintrc.json`, `tsconfig.json`, `package.json` → `apps/frontend/package.json`, `.env.development.local`, `.vercel/`) into `apps/frontend/`
- Remove: `package-lock.json` (switching to pnpm)

**Interfaces:** None — this task produces no new code, only a relocated, still-working frontend app. Later tasks depend on `apps/frontend/` existing and `pnpm --dir apps/frontend run dev` working.

- [ ] **Step 1: Create the `apps/frontend` directory and move all existing app files into it**

```bash
mkdir -p apps/frontend
git mv src apps/frontend/src
git mv public apps/frontend/public
git mv certificates apps/frontend/certificates
git mv next.config.mjs apps/frontend/next.config.mjs
git mv tailwind.config.ts apps/frontend/tailwind.config.ts
git mv postcss.config.mjs apps/frontend/postcss.config.mjs
git mv components.json apps/frontend/components.json
git mv next-auth.d.ts apps/frontend/next-auth.d.ts
git mv next-env.d.ts apps/frontend/next-env.d.ts
git mv .eslintrc.json apps/frontend/.eslintrc.json
git mv tsconfig.json apps/frontend/tsconfig.json
git mv package.json apps/frontend/package.json
git mv .env.development.local apps/frontend/.env.development.local
git mv .vercel apps/frontend/.vercel
git rm package-lock.json
```

Note: the backend is now Python, so `apps/frontend` is the only TypeScript project in the repo — there is no longer a shared `tsconfig.base.json` to create; `apps/frontend/tsconfig.json` needs no `extends` change. If `postcss.config.js` (not `.mjs`) is the file actually present on disk, move that one instead — check with `ls apps/frontend 2>/dev/null; ls postcss.config.*` first. If pnpm isn't installed yet: `corepack enable && corepack prepare pnpm@9 --activate`.

- [ ] **Step 2: Create the new root `package.json`**

```json
{
  "name": "bookkeeping",
  "private": true,
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
```

(Scripts are added in Task 13 once `apps/backend` exists — for now this just holds `concurrently` for later.)

- [ ] **Step 3: Install and verify the frontend still works from its new location**

```bash
pnpm install
pnpm --dir apps/frontend install
pnpm --dir apps/frontend run dev
```

Expected: a root `pnpm-lock.yaml` (tiny, just `concurrently`) and a separate `apps/frontend/pnpm-lock.yaml` (the real one) are generated; the Next.js dev server starts on `https://localhost:3000` exactly as before the move (Ctrl-C to stop once confirmed).

- [ ] **Step 4: Update `.gitignore` for the new layout**

```
node_modules
apps/frontend/.next/
apps/frontend/out/
apps/backend/.venv/
apps/backend/__pycache__/
apps/backend/**/__pycache__/
apps/backend/**/migrations/__pycache__/
.env
.env.local
.env.*.local
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: move Next.js app into apps/frontend as a standalone pnpm project"
```

---

## Task 2: Backend project scaffold — Django + DRF via uv

**Files:**
- Create: `apps/backend/pyproject.toml`
- Create: `apps/backend/config/__init__.py`, `apps/backend/config/settings.py`, `apps/backend/config/urls.py`, `apps/backend/config/wsgi.py`
- Create: `apps/backend/api/__init__.py`, `apps/backend/api/apps.py`
- Create: `apps/backend/manage.py`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/.gitignore`

**Interfaces:** None yet — pure scaffolding. Later tasks add `api/models.py`, `api/services.py`, `api/authentication.py`, `api/permissions.py`, `api/views.py`, `api/urls.py` into the `api` app created here, and rely on `config.settings` reading `DATABASE_URL`/`JWT_SECRET`/`INTERNAL_API_SECRET`/`FRONTEND_URL` from the environment (with dev-friendly defaults so `pytest` works without exporting anything, as long as a local Postgres is reachable).

- [ ] **Step 1: Scaffold the uv project and Django project/app**

```bash
mkdir -p apps/backend
cd apps/backend
uv init --no-readme --python 3.12 --name backend
uv add django djangorestframework django-cors-headers dj-database-url "psycopg[binary]" pyjwt python-dateutil gunicorn
uv add --dev pytest pytest-django
uv run django-admin startproject config .
uv run python manage.py startapp api
cd ../..
```

This generates `manage.py`, `config/` (with Django's default `settings.py`/`urls.py`/`wsgi.py`/`asgi.py`), `api/` (with Django's default `apps.py`/`models.py`/`views.py`/etc. — the next steps and tasks overwrite the relevant ones), and a `pyproject.toml` with `django`, `djangorestframework`, `django-cors-headers`, `dj-database-url`, `psycopg[binary]`, `pyjwt`, `python-dateutil`, `gunicorn` under `[project.dependencies]` and `pytest`/`pytest-django` under `[dependency-groups.dev]`.

- [ ] **Step 2: Add `[tool.uv]` and `[tool.pytest.ini_options]` to `apps/backend/pyproject.toml`**

Append these two tables to the generated `pyproject.toml` (don't remove what `uv init`/`uv add` already wrote):

```toml
[tool.uv]
package = false

[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings"
python_files = ["test_*.py"]
testpaths = ["tests"]
```

- [ ] **Step 3: Replace `apps/backend/config/settings.py`'s generated content with:**

```python
import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-django-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "corsheaders",
    "api",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.parse(
        os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/bookkeeping"),
        conn_max_age=600,
    )
}

DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
USE_TZ = True

CORS_ALLOWED_ORIGINS = [os.environ.get("FRONTEND_URL", "https://localhost:3000")]
CORS_ALLOW_CREDENTIALS = False

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret")
INTERNAL_API_SECRET = os.environ.get("INTERNAL_API_SECRET", "dev-internal-secret")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
}
```

The `os.environ.get(..., <dev default>)` pattern (rather than `os.environ[...]`) is deliberate: it lets `pytest` and local `manage.py` commands run against the docker-compose Postgres/dev secrets without exporting anything by hand, while still being fully overridable via real env vars in an actual deployment. This mirrors the existing frontend's own `"default-secret"` fallback pattern in `auth.ts` — not a production security posture, just a local-dev convenience, and worth calling out as such in code review.

- [ ] **Step 4: Replace `apps/backend/api/apps.py`'s generated content with:**

```python
from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.AutoField"
    name = "api"
```

- [ ] **Step 5: Create `apps/backend/.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bookkeeping
JWT_SECRET=
INTERNAL_API_SECRET=
FRONTEND_URL=https://localhost:3000
DJANGO_SECRET_KEY=
DJANGO_DEBUG=false
```

- [ ] **Step 6: Create `apps/backend/.gitignore`**

```
.venv
__pycache__/
*.pyc
.env
staticfiles/
```

- [ ] **Step 7: Verify the scaffold boots and pytest runs (no tests yet)**

```bash
cd apps/backend
uv run python manage.py check
uv run pytest
cd ../..
```

Expected: `manage.py check` reports no issues; `pytest` reports "no tests ran" (not an error).

- [ ] **Step 8: Commit**

```bash
git add apps/backend
git commit -m "chore: scaffold apps/backend as a Django + DRF project managed with uv"
```

---

## Task 3: Models + initial migration

**Files:**
- Create: `apps/backend/api/models.py` (overwrite Django's generated empty one)
- Create: `apps/backend/api/migrations/0001_initial.py` (generated by `makemigrations`, not hand-written)
- Test: `apps/backend/tests/__init__.py`, `apps/backend/tests/test_models.py`

**Interfaces:**
- Produces: `User` (fields: `user_id` PK, `google_id`, `email`, `user_name`, `uuid`), `Category` (`category_id` PK, `user` FK → column `user_id`, `category_name`, `category_icon`), `Record` (`record_id` PK, `record_date`, `record_type`, `amount`, `category` FK → column `category_id`, `user` FK → column `user_id`, `description`). Every later task's services/views import these three models from `api.models`.

- [ ] **Step 1: Write `apps/backend/api/models.py`**

Gotcha: `User.uuid`'s default must be a named function, not a `lambda` — Django's migration writer calls `ValueError: Cannot serialize function: lambda` when `makemigrations` tries to serialize a lambda default into the migration file. Use `generate_uuid()` below instead.

```python
import uuid as uuid_lib

from django.db import models


def generate_uuid() -> str:
    return str(uuid_lib.uuid4())


class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    google_id = models.CharField(max_length=255, unique=True)
    email = models.EmailField()
    user_name = models.CharField(max_length=255)
    uuid = models.CharField(max_length=36, default=generate_uuid)

    class Meta:
        db_table = "users"

    def __str__(self) -> str:
        return self.google_id


class Category(models.Model):
    category_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    category_name = models.CharField(max_length=255)
    category_icon = models.CharField(max_length=255)

    class Meta:
        db_table = "categories"

    def __str__(self) -> str:
        return self.category_name


class Record(models.Model):
    record_id = models.AutoField(primary_key=True)
    record_date = models.CharField(max_length=64)
    record_type = models.CharField(max_length=32)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="records")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="records")
    description = models.TextField(blank=True, default="")

    class Meta:
        db_table = "records"

    def __str__(self) -> str:
        return f"{self.record_type} {self.amount}"
```

`ForeignKey` fields named `user`/`category` get Django's default DB column names `user_id`/`category_id` — matching the existing table layout without needing an explicit `db_column=`.

- [ ] **Step 2: Generate the migration**

```bash
cd apps/backend
uv run python manage.py makemigrations api
cd ../..
```

Expected: `api/migrations/0001_initial.py` is created. Open it and sanity-check it defines exactly the three tables above with the expected columns — this project had zero migration files before this task (schema was managed by hand), so this is the first one ever.

- [ ] **Step 3: Create `apps/backend/tests/__init__.py`** (empty file, makes `tests` a package)

- [ ] **Step 4: Write `apps/backend/tests/test_models.py`**

```python
import pytest

from api.models import Category, Record, User

pytestmark = pytest.mark.django_db


def test_creating_a_user_assigns_a_uuid():
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    assert user.uuid
    assert user.user_id is not None


def test_category_belongs_to_a_user():
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    category = Category.objects.create(user=user, category_name="Food", category_icon="apple")
    assert category.user_id == user.user_id


def test_record_belongs_to_a_user_and_category():
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    category = Category.objects.create(user=user, category_name="Food", category_icon="apple")
    record = Record.objects.create(
        record_date="Mon Jan 5 2026",
        record_type="expenses",
        amount="12.50",
        category=category,
        user=user,
        description="coffee",
    )
    assert record.user_id == user.user_id
    assert record.category_id == category.category_id
```

This needs a reachable Postgres (e.g. `docker compose up -d postgres`, added in Task 10) so pytest-django can create its throwaway test database before this will pass.

- [ ] **Step 5: Run the tests**

```bash
cd apps/backend
uv run pytest
cd ../..
```

Expected: PASS (3 tests). If it fails with a connection error, start Postgres first (`docker compose up -d postgres`, once Task 10 adds it — until then, point `DATABASE_URL` at any reachable local Postgres).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/api/models.py apps/backend/api/migrations apps/backend/tests
git commit -m "feat(backend): add User, Category, Record models and initial migration"
```

---

## Task 4: `api/services.py`

**Files:**
- Create: `apps/backend/api/services.py`
- Test: `apps/backend/tests/test_services.py`

**Interfaces:**
- Consumes: `User`, `Category` from `api.models`
- Produces: `get_user_id_by_google_id(google_id: str) -> int | None`, `bootstrap_user(*, google_id: str, email: str, user_name: str) -> None`, `to_date_string(record_date: str) -> str`. Tasks 6-8's views import all three.

- [ ] **Step 1: Write the failing tests**

```python
# apps/backend/tests/test_services.py
import pytest

from api.models import Category, User
from api.services import bootstrap_user, get_user_id_by_google_id, to_date_string

pytestmark = pytest.mark.django_db


def test_get_user_id_by_google_id_returns_none_when_missing():
    assert get_user_id_by_google_id("missing") is None


def test_get_user_id_by_google_id_returns_the_id_when_found():
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    assert get_user_id_by_google_id("g1") == user.user_id


def test_bootstrap_user_creates_user_and_default_category():
    bootstrap_user(google_id="g1", email="a@b.com", user_name="A")
    user = User.objects.get(google_id="g1")
    categories = list(Category.objects.filter(user=user))
    assert len(categories) == 1
    assert categories[0].category_name == "Food"
    assert categories[0].category_icon == "apple"


def test_bootstrap_user_is_idempotent():
    bootstrap_user(google_id="g1", email="a@b.com", user_name="A")
    bootstrap_user(google_id="g1", email="a@b.com", user_name="A")
    assert User.objects.filter(google_id="g1").count() == 1
    assert Category.objects.filter(user__google_id="g1").count() == 1


@pytest.mark.parametrize(
    "record_date,expected",
    [
        ("2026-01-05", "Mon Jan 5 2026"),
        ("Mon Jan 5 2026", "Mon Jan 5 2026"),
    ],
)
def test_to_date_string_matches_js_todatestring_format(record_date, expected):
    assert to_date_string(record_date) == expected
```

(`2026-01-05` is a Monday — the second case checks that already-formatted input, which is what the frontend actually sends today via `new Date().toDateString()`, round-trips unchanged.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/backend && uv run pytest tests/test_services.py && cd ../..
```

Expected: FAIL — `ModuleNotFoundError: No module named 'api.services'`.

- [ ] **Step 3: Write `apps/backend/api/services.py`**

```python
from dateutil import parser as date_parser

from .models import Category, User


def get_user_id_by_google_id(google_id: str) -> int | None:
    return User.objects.filter(google_id=google_id).values_list("user_id", flat=True).first()


def bootstrap_user(*, google_id: str, email: str, user_name: str) -> None:
    if User.objects.filter(google_id=google_id).exists():
        return
    user = User.objects.create(google_id=google_id, email=email, user_name=user_name)
    Category.objects.create(user=user, category_name="Food", category_icon="apple")


def to_date_string(record_date: str) -> str:
    dt = date_parser.parse(record_date)
    return f"{dt.strftime('%a %b')} {dt.day} {dt.year}"
```

`to_date_string` mirrors JS's `new Date(x).toDateString()` output (`"Www Mmm d yyyy"`, day not zero-padded) using `python-dateutil`'s lenient parser so it accepts both ISO dates and already-`toDateString`-formatted strings, the same way JS's `Date` constructor does.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_services.py && cd ../..
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/backend/api/services.py apps/backend/tests/test_services.py
git commit -m "feat(backend): add get_user_id_by_google_id, bootstrap_user, to_date_string"
```

---

## Task 5: JWT authentication + internal-secret permission

**Files:**
- Create: `apps/backend/api/authentication.py`
- Create: `apps/backend/api/permissions.py`
- Test: `apps/backend/tests/test_authentication.py`, `apps/backend/tests/test_permissions.py`

**Interfaces:**
- Produces: `JWTAuthentication` (a DRF `BaseAuthentication`), `GoogleUser` (has `.google_id` and `.is_authenticated = True`), `HasInternalSecret` (a DRF `BasePermission`). Tasks 6-8's views use `authentication_classes = [JWTAuthentication]` / `permission_classes = [IsAuthenticated]` for user-facing routes, and `permission_classes = [HasInternalSecret]` (with `authentication_classes = []`) for the internal bootstrap route.

- [ ] **Step 1: Write the failing tests**

```python
# apps/backend/tests/test_authentication.py
import jwt
import pytest
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.test import APIRequestFactory

from api.authentication import GoogleUser, JWTAuthentication

JWT_SECRET = "test-jwt-secret"
factory = APIRequestFactory()


def _request(header_value=None):
    headers = {"HTTP_AUTHORIZATION": header_value} if header_value else {}
    return factory.get("/", **headers)


def test_returns_none_without_authorization_header(settings):
    settings.JWT_SECRET = JWT_SECRET
    assert JWTAuthentication().authenticate(_request()) is None


def test_raises_on_invalid_token(settings):
    settings.JWT_SECRET = JWT_SECRET
    with pytest.raises(AuthenticationFailed):
        JWTAuthentication().authenticate(_request("Bearer not-a-real-token"))


def test_returns_google_user_on_valid_token(settings):
    settings.JWT_SECRET = JWT_SECRET
    token = jwt.encode({"sub": "google-123"}, JWT_SECRET, algorithm="HS256")
    user, auth = JWTAuthentication().authenticate(_request(f"Bearer {token}"))
    assert isinstance(user, GoogleUser)
    assert user.google_id == "google-123"
    assert user.is_authenticated is True
    assert auth is None


def test_declares_a_bearer_authenticate_header():
    assert JWTAuthentication().authenticate_header(_request()) == "Bearer"
```

```python
# apps/backend/tests/test_permissions.py
from rest_framework.test import APIRequestFactory

from api.permissions import HasInternalSecret

factory = APIRequestFactory()


def test_denies_without_header(settings):
    settings.INTERNAL_API_SECRET = "secret"
    request = factory.post("/")
    assert HasInternalSecret().has_permission(request, None) is False


def test_allows_with_correct_header(settings):
    settings.INTERNAL_API_SECRET = "secret"
    request = factory.post("/", HTTP_X_INTERNAL_SECRET="secret")
    assert HasInternalSecret().has_permission(request, None) is True
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/backend && uv run pytest tests/test_authentication.py tests/test_permissions.py && cd ../..
```

Expected: FAIL — `ModuleNotFoundError` for both `api.authentication` and `api.permissions`.

- [ ] **Step 3: Write `apps/backend/api/authentication.py`**

```python
import jwt
from django.conf import settings
from rest_framework import authentication, exceptions


class GoogleUser:
    is_authenticated = True

    def __init__(self, google_id: str):
        self.google_id = google_id

    def __str__(self) -> str:
        return self.google_id


class JWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get("Authorization")
        if not header or not header.startswith("Bearer "):
            return None
        token = header[len("Bearer "):]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        except jwt.PyJWTError as exc:
            raise exceptions.AuthenticationFailed("Invalid token") from exc
        return (GoogleUser(payload["sub"]), None)

    def authenticate_header(self, request):
        return "Bearer"
```

`authenticate_header` matters more than it looks: DRF's exception handler downgrades a 401 to a 403 whenever no configured authenticator returns a truthy `authenticate_header` — without this method, every missing/invalid-token request would silently come back as 403 instead of 401.

- [ ] **Step 4: Write `apps/backend/api/permissions.py`**

```python
from django.conf import settings
from rest_framework import permissions


class HasInternalSecret(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return request.headers.get("x-internal-secret") == settings.INTERNAL_API_SECRET
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_authentication.py tests/test_permissions.py && cd ../..
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/api/authentication.py apps/backend/api/permissions.py apps/backend/tests/test_authentication.py apps/backend/tests/test_permissions.py
git commit -m "feat(backend): add JWT authentication and internal-secret permission"
```

---

## Task 6: Serializers + categories view

**Files:**
- Create: `apps/backend/api/serializers.py`
- Create: `apps/backend/api/views.py` (overwrite Django's generated empty one — starts with `AuthenticatedAPIView` + `CategoryListView` here; later tasks append to it)
- Create: `apps/backend/api/urls.py`
- Modify: `apps/backend/config/urls.py`
- Test: `apps/backend/tests/test_views_categories.py`

**Interfaces:**
- Consumes: `get_user_id_by_google_id` (Task 4), `JWTAuthentication` (Task 5)
- Produces: `CategorySerializer`, `AuthenticatedAPIView` (base class every later protected view subclasses), `CategoryListView`, mounted at `GET /users/<user_google_id>/categories`

- [ ] **Step 1: Write the failing test**

```python
# apps/backend/tests/test_views_categories.py
import jwt
import pytest
from rest_framework.test import APIClient

from api.models import Category, User

JWT_SECRET = "test-jwt-secret"

pytestmark = pytest.mark.django_db


def _auth_client(sub: str) -> APIClient:
    client = APIClient()
    token = jwt.encode({"sub": sub}, JWT_SECRET, algorithm="HS256")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def test_requires_authentication(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = APIClient().get("/users/g1/categories")
    assert response.status_code == 401


def test_forbids_mismatched_google_id(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = _auth_client("g1").get("/users/someone-else/categories")
    assert response.status_code == 403


def test_returns_404_for_unknown_user(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = _auth_client("g1").get("/users/g1/categories")
    assert response.status_code == 404


def test_returns_the_users_categories(settings):
    settings.JWT_SECRET = JWT_SECRET
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    Category.objects.create(user=user, category_name="Food", category_icon="apple")
    response = _auth_client("g1").get("/users/g1/categories")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["category_name"] == "Food"
    assert body[0]["user_id"] == user.user_id
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/backend && uv run pytest tests/test_views_categories.py && cd ../..
```

Expected: FAIL — route `/users/g1/categories` doesn't exist yet (404 for everything, including the 401/403 cases that expect otherwise).

- [ ] **Step 3: Write `apps/backend/api/serializers.py`**

```python
from rest_framework import serializers

from .models import Category, Record, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["user_id", "google_id", "email", "user_name", "uuid"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["category_id", "user_id", "category_name", "category_icon"]


class RecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Record
        fields = ["record_id", "record_date", "record_type", "amount", "category_id", "user_id", "description"]


class CreateRecordSerializer(serializers.Serializer):
    recordDate = serializers.CharField()
    recordType = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    categoryId = serializers.IntegerField()
    description = serializers.CharField(allow_blank=True, required=False, default="")


class CreateGlobalRecordSerializer(CreateRecordSerializer):
    userId = serializers.IntegerField()
```

(Serializer field names are camelCase — `recordDate`, `categoryId`, etc. — matching the JSON keys the frontend already sends, rather than being renamed to snake_case with a `source=` mapping. Slightly off Python convention, but keeps the wire format identical to today's.)

- [ ] **Step 4: Write `apps/backend/api/views.py`**

```python
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import JWTAuthentication
from .models import Category
from .serializers import CategorySerializer
from .services import get_user_id_by_google_id


class AuthenticatedAPIView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]


class CategoryListView(AuthenticatedAPIView):
    def get(self, request, user_google_id):
        if user_google_id != request.user.google_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        user_id = get_user_id_by_google_id(user_google_id)
        if user_id is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        categories = Category.objects.filter(user_id=user_id)
        return Response(CategorySerializer(categories, many=True).data)
```

- [ ] **Step 5: Write `apps/backend/api/urls.py`**

```python
from django.urls import path

from . import views

urlpatterns = [
    path("users/<str:user_google_id>/categories", views.CategoryListView.as_view()),
]
```

- [ ] **Step 6: Wire it into `apps/backend/config/urls.py`**

```python
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health", health),
    path("", include("api.urls")),
]
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd apps/backend && uv run pytest tests/test_views_categories.py && cd ../..
```

Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/api/serializers.py apps/backend/api/views.py apps/backend/api/urls.py apps/backend/config/urls.py apps/backend/tests/test_views_categories.py
git commit -m "feat(backend): add GET /users/<user_google_id>/categories"
```

---

## Task 7: Records views

**Files:**
- Modify: `apps/backend/api/views.py` (append `UserRecordsView`, `GlobalRecordsView`)
- Modify: `apps/backend/api/urls.py`
- Test: `apps/backend/tests/test_views_records.py`

**Interfaces:**
- Consumes: `get_user_id_by_google_id`, `to_date_string` (Task 4), `RecordSerializer`, `CreateRecordSerializer`, `CreateGlobalRecordSerializer` (Task 6), `AuthenticatedAPIView` (Task 6)
- Produces: `UserRecordsView` at `GET/POST /users/<user_google_id>/records`, `GlobalRecordsView` at `GET/POST /records`

- [ ] **Step 1: Write the failing tests**

```python
# apps/backend/tests/test_views_records.py
import jwt
import pytest
from rest_framework.test import APIClient

from api.models import Category, Record, User

JWT_SECRET = "test-jwt-secret"

pytestmark = pytest.mark.django_db


def _auth_client(sub: str) -> APIClient:
    client = APIClient()
    token = jwt.encode({"sub": sub}, JWT_SECRET, algorithm="HS256")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def test_user_records_forbids_mismatched_google_id(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = _auth_client("g1").get("/users/someone-else/records")
    assert response.status_code == 403


def test_user_records_returns_the_users_records(settings):
    settings.JWT_SECRET = JWT_SECRET
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    category = Category.objects.create(user=user, category_name="Food", category_icon="apple")
    Record.objects.create(
        record_date="Mon Jan 5 2026", record_type="expenses", amount="12.50",
        category=category, user=user, description="coffee",
    )
    response = _auth_client("g1").get("/users/g1/records")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["description"] == "coffee"


def test_user_records_post_resolves_user_id_server_side(settings):
    settings.JWT_SECRET = JWT_SECRET
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    category = Category.objects.create(user=user, category_name="Food", category_icon="apple")
    response = _auth_client("g1").post(
        "/users/g1/records",
        {
            "recordDate": "2026-01-05",
            "recordType": "expenses",
            "amount": "10",
            "categoryId": category.category_id,
            "description": "tea",
        },
        format="json",
    )
    assert response.status_code == 200
    record = Record.objects.get()
    assert record.user_id == user.user_id
    assert record.record_date == "Mon Jan 5 2026"


def test_global_records_requires_auth_and_returns_everything(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = _auth_client("g1").get("/records")
    assert response.status_code == 200
    assert response.json() == []


def test_global_records_rejects_with_no_token(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = APIClient().get("/records")
    assert response.status_code == 401


def test_global_records_post_uses_userid_from_body(settings):
    settings.JWT_SECRET = JWT_SECRET
    user = User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    category = Category.objects.create(user=user, category_name="Food", category_icon="apple")
    response = _auth_client("g1").post(
        "/records",
        {
            "recordDate": "2026-01-05",
            "recordType": "income",
            "amount": "100",
            "categoryId": category.category_id,
            "userId": user.user_id,
            "description": "salary",
        },
        format="json",
    )
    assert response.status_code == 200
    assert Record.objects.get().user_id == user.user_id
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/backend && uv run pytest tests/test_views_records.py && cd ../..
```

Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Append to `apps/backend/api/views.py`**

```python
from .models import Record
from .serializers import CreateGlobalRecordSerializer, CreateRecordSerializer, RecordSerializer
from .services import to_date_string


class UserRecordsView(AuthenticatedAPIView):
    def get(self, request, user_google_id):
        if user_google_id != request.user.google_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        user_id = get_user_id_by_google_id(user_google_id)
        if user_id is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        records = Record.objects.filter(user_id=user_id)
        return Response(RecordSerializer(records, many=True).data)

    def post(self, request, user_google_id):
        if user_google_id != request.user.google_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        user_id = get_user_id_by_google_id(user_google_id)
        if user_id is None:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CreateRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        Record.objects.create(
            record_date=to_date_string(str(data["recordDate"])),
            record_type=data["recordType"],
            amount=data["amount"],
            category_id=data["categoryId"],
            user_id=user_id,
            description=data.get("description", ""),
        )
        return Response({"message": "Success"})


class GlobalRecordsView(AuthenticatedAPIView):
    def get(self, request):
        records = Record.objects.all()
        return Response(RecordSerializer(records, many=True).data)

    def post(self, request):
        serializer = CreateGlobalRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        Record.objects.create(
            record_date=to_date_string(str(data["recordDate"])),
            record_type=data["recordType"],
            amount=data["amount"],
            category_id=data["categoryId"],
            user_id=data["userId"],
            description=data.get("description", ""),
        )
        return Response({"message": "Success"})
```

(Add the three new imports at the top of the file alongside the existing ones — `Record` next to `Category` in the `.models` import, `RecordSerializer`/`CreateRecordSerializer`/`CreateGlobalRecordSerializer` next to `CategorySerializer` in the `.serializers` import, `to_date_string` next to `get_user_id_by_google_id` in the `.services` import.)

- [ ] **Step 4: Append to `apps/backend/api/urls.py`**

```python
urlpatterns += [
    path("users/<str:user_google_id>/records", views.UserRecordsView.as_view()),
    path("records", views.GlobalRecordsView.as_view()),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_views_records.py && cd ../..
```

Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/api/views.py apps/backend/api/urls.py apps/backend/tests/test_views_records.py
git commit -m "feat(backend): add /records and /users/<user_google_id>/records"
```

---

## Task 8: UserInfo view + internal bootstrap view

**Files:**
- Modify: `apps/backend/api/views.py` (append `UserInfoView`, `InternalBootstrapView`)
- Modify: `apps/backend/api/urls.py`
- Test: `apps/backend/tests/test_views_user_info.py`, `apps/backend/tests/test_views_internal.py`

**Interfaces:**
- Consumes: `UserSerializer` (Task 6), `bootstrap_user` (Task 4), `HasInternalSecret` (Task 5)
- Produces: `UserInfoView` at `GET /userInfo`, `InternalBootstrapView` at `POST /internal/users/bootstrap`

- [ ] **Step 1: Write the failing tests**

```python
# apps/backend/tests/test_views_user_info.py
import jwt
import pytest
from rest_framework.test import APIClient

from api.models import User

JWT_SECRET = "test-jwt-secret"

pytestmark = pytest.mark.django_db


def _auth_client(sub: str) -> APIClient:
    client = APIClient()
    token = jwt.encode({"sub": sub}, JWT_SECRET, algorithm="HS256")
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def test_returns_404_when_no_matching_user(settings):
    settings.JWT_SECRET = JWT_SECRET
    response = _auth_client("g1").get("/userInfo")
    assert response.status_code == 404


def test_returns_the_db_user_row_for_the_jwt_subject(settings):
    settings.JWT_SECRET = JWT_SECRET
    User.objects.create(google_id="g1", email="a@b.com", user_name="A")
    response = _auth_client("g1").get("/userInfo")
    assert response.status_code == 200
    assert response.json()["google_id"] == "g1"
```

```python
# apps/backend/tests/test_views_internal.py
import pytest
from rest_framework.test import APIClient

from api.models import Category, User

INTERNAL_SECRET = "test-internal-secret"

pytestmark = pytest.mark.django_db


def test_rejects_without_internal_secret(settings):
    settings.INTERNAL_API_SECRET = INTERNAL_SECRET
    response = APIClient().post(
        "/internal/users/bootstrap",
        {"googleId": "g1", "email": "a@b.com", "userName": "A"},
        format="json",
    )
    assert response.status_code == 403


def test_bootstraps_a_new_user(settings):
    settings.INTERNAL_API_SECRET = INTERNAL_SECRET
    client = APIClient()
    client.credentials(HTTP_X_INTERNAL_SECRET=INTERNAL_SECRET)
    response = client.post(
        "/internal/users/bootstrap",
        {"googleId": "g1", "email": "a@b.com", "userName": "A"},
        format="json",
    )
    assert response.status_code == 200
    user = User.objects.get(google_id="g1")
    assert Category.objects.filter(user=user, category_name="Food").exists()
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/backend && uv run pytest tests/test_views_user_info.py tests/test_views_internal.py && cd ../..
```

Expected: FAIL — neither route exists yet.

- [ ] **Step 3: Append to `apps/backend/api/views.py`**

```python
from .models import User
from .permissions import HasInternalSecret
from .serializers import UserSerializer
from .services import bootstrap_user


class UserInfoView(AuthenticatedAPIView):
    def get(self, request):
        try:
            user = User.objects.get(google_id=request.user.google_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)


class InternalBootstrapView(APIView):
    authentication_classes: list = []
    permission_classes = [HasInternalSecret]

    def post(self, request):
        bootstrap_user(
            google_id=request.data.get("googleId"),
            email=request.data.get("email"),
            user_name=request.data.get("userName"),
        )
        return Response({"message": "ok"})
```

(`User` joins the existing `.models` import; `HasInternalSecret` and `UserSerializer`/`bootstrap_user` are new imports alongside the existing ones from `.permissions`/`.serializers`/`.services`.)

- [ ] **Step 4: Append to `apps/backend/api/urls.py`**

```python
urlpatterns += [
    path("userInfo", views.UserInfoView.as_view()),
    path("internal/users/bootstrap", views.InternalBootstrapView.as_view()),
]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_views_user_info.py tests/test_views_internal.py && cd ../..
```

Expected: PASS (4 tests). Run the full suite once more to confirm everything so far is green: `uv run pytest`.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/api/views.py apps/backend/api/urls.py apps/backend/tests/test_views_user_info.py apps/backend/tests/test_views_internal.py
git commit -m "feat(backend): add /userInfo and /internal/users/bootstrap"
```

---

## Task 9: `wait_for_db` management command

**Files:**
- Create: `apps/backend/api/management/__init__.py`, `apps/backend/api/management/commands/__init__.py`, `apps/backend/api/management/commands/wait_for_db.py`
- Test: `apps/backend/tests/test_wait_for_db.py`

**Interfaces:**
- Produces: a Django management command `wait_for_db` (invoked as `python manage.py wait_for_db`), used by Task 10's `docker-entrypoint.sh` before running migrations.

- [ ] **Step 1: Write the failing tests**

```python
# apps/backend/tests/test_wait_for_db.py
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command
from django.db.utils import OperationalError


def test_succeeds_immediately_when_db_is_up():
    with patch("api.management.commands.wait_for_db.connections") as mock_connections:
        call_command("wait_for_db", "--retries=3", "--delay=0", stdout=StringIO())
        mock_connections.__getitem__.assert_called_with("default")
        assert mock_connections.__getitem__.return_value.cursor.call_count == 1


def test_retries_then_succeeds():
    with patch("api.management.commands.wait_for_db.connections") as mock_connections:
        mock_cursor = mock_connections.__getitem__.return_value.cursor
        mock_cursor.side_effect = [OperationalError("not ready"), None]
        call_command("wait_for_db", "--retries=3", "--delay=0", stdout=StringIO())
        assert mock_cursor.call_count == 2


def test_raises_after_exhausting_retries():
    with patch("api.management.commands.wait_for_db.connections") as mock_connections:
        mock_connections.__getitem__.return_value.cursor.side_effect = OperationalError("still not ready")
        with pytest.raises(OperationalError):
            call_command("wait_for_db", "--retries=2", "--delay=0", stdout=StringIO())
```

(Patching `api.management.commands.wait_for_db.connections` — the name as imported *into that module* — not `django.db.connections`, since the module does `from django.db import connections` and binds its own local reference at import time.)

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/backend && uv run pytest tests/test_wait_for_db.py && cd ../..
```

Expected: FAIL — `ModuleNotFoundError: No module named 'api.management.commands.wait_for_db'`.

- [ ] **Step 3: Create the empty `__init__.py` files**

```bash
mkdir -p apps/backend/api/management/commands
touch apps/backend/api/management/__init__.py
touch apps/backend/api/management/commands/__init__.py
```

- [ ] **Step 4: Write `apps/backend/api/management/commands/wait_for_db.py`**

```python
import time

from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Wait for the database to accept connections before continuing."

    def add_arguments(self, parser):
        parser.add_argument("--retries", type=int, default=10)
        parser.add_argument("--delay", type=float, default=1.0)

    def handle(self, *args, **options):
        retries = options["retries"]
        delay = options["delay"]
        for attempt in range(1, retries + 1):
            try:
                connections["default"].cursor()
                self.stdout.write(self.style.SUCCESS("Database available"))
                return
            except OperationalError:
                self.stdout.write(
                    f"Database unavailable, attempt {attempt}/{retries}, retrying in {delay}s..."
                )
                if attempt < retries:
                    time.sleep(delay)
        raise OperationalError("Database unavailable after retries")
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd apps/backend && uv run pytest tests/test_wait_for_db.py && cd ../..
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/backend/api/management apps/backend/tests/test_wait_for_db.py
git commit -m "feat(backend): add wait_for_db management command"
```

---

## Task 10: Dockerfile + docker-compose

**Files:**
- Create: `apps/backend/Dockerfile`
- Create: `apps/backend/.dockerignore`
- Create: `apps/backend/docker-entrypoint.sh`
- Create: `docker-compose.yml` (repo root)

**Interfaces:** None — pure infra. Consumes everything built in Tasks 2-9.

- [ ] **Step 1: Write `apps/backend/Dockerfile`**

Gotcha: every `uv run` invocation at container runtime must pass `--no-sync`. Without it, `uv run` does an implicit sync before running the command — and that implicit sync ignores the `--no-dev` used at build time, silently reinstalling `pytest`/`pytest-django`/etc. into the "production" container on every start. `--no-sync` makes `uv run` use the environment exactly as `uv sync --frozen --no-dev` built it.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
RUN chmod +x docker-entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["uv", "run", "--no-sync", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:4000"]
```

- [ ] **Step 2: Write `apps/backend/.dockerignore`**

```
.venv
__pycache__/
*.pyc
.env
tests/
```

- [ ] **Step 3: Write `apps/backend/docker-entrypoint.sh`**

```bash
#!/bin/sh
set -e

uv run --no-sync python manage.py wait_for_db
uv run --no-sync python manage.py migrate --noinput

exec "$@"
```

```bash
chmod +x apps/backend/docker-entrypoint.sh
```

- [ ] **Step 4: Write `docker-compose.yml` at the repo root**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: bookkeeping
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  backend:
    build:
      context: ./apps/backend
    ports:
      - "4000:4000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/bookkeeping
      JWT_SECRET: dev-jwt-secret
      INTERNAL_API_SECRET: dev-internal-secret
      FRONTEND_URL: https://localhost:3000
      DJANGO_SECRET_KEY: dev-django-secret-key
    depends_on:
      - postgres

volumes:
  pgdata:
```

No `schema.sql` init script is needed — `docker-entrypoint.sh` runs Django migrations automatically on every container start, which is what actually creates the schema.

- [ ] **Step 5: Build and boot the stack**

```bash
docker compose up --build -d
docker compose logs backend
curl http://localhost:4000/health
```

Expected: `curl` returns `{"status": "ok"}`, and the backend logs show `wait_for_db` succeeding followed by `Applying api.0001_initial... OK` from the migrate step — no manual restart needed even on a completely fresh `pgdata` volume, since `wait_for_db` retries until Postgres is actually ready.

- [ ] **Step 6: Tear down and commit**

```bash
docker compose down
git add apps/backend/Dockerfile apps/backend/.dockerignore apps/backend/docker-entrypoint.sh docker-compose.yml
git commit -m "feat(backend): add Dockerfile, entrypoint (wait_for_db + migrate), and docker-compose"
```

---

## Task 11: Frontend auth wiring (apiToken issuance + HTTP bootstrap call)

**Files:**
- Modify: `apps/frontend/src/app/configs/auth.ts`
- Modify: `apps/frontend/next-auth.d.ts`
- Modify: `apps/frontend/.env.development.local` (add new vars)
- Modify: `apps/frontend/package.json` (add `jsonwebtoken` + its types)

**Interfaces:**
- Consumes: `POST /internal/users/bootstrap` (Task 8)
- Produces: `session.apiToken: string` on every NextAuth session, consumed by Task 12's fetch calls.

- [ ] **Step 1: Add `jsonwebtoken` to the frontend**

```bash
pnpm add jsonwebtoken --dir apps/frontend
pnpm add -D @types/jsonwebtoken --dir apps/frontend
```

- [ ] **Step 2: Update `apps/frontend/next-auth.d.ts`**

```typescript
import NextAuth from 'next-auth';
declare module 'next-auth' {
    interface Session {
        user: {
                id: string;
        } & DefaultSession['user'];
        apiToken: string;
    }
}
```

- [ ] **Step 3: Rewrite `apps/frontend/src/app/configs/auth.ts`**

```typescript
import type { NextAuthOptions } from "next-auth"
import { Account, Profile } from "next-auth"
import jwt from "jsonwebtoken";

import GoogleProvider from "next-auth/providers/google"

type SessionProps = {
  session: any;
  token: any;
};

export const authOptions: NextAuthOptions = {
  providers:[
    GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    }),
  ],
  callbacks: {
    async signIn({account, profile}:{account: Account | null; profile?: Profile | undefined;}) {
        const isAccount = account && profile
        if (isAccount && account.provider === "google") {
            return true
          }
        return true
    },
    session: async ({ session, token }: SessionProps) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.apiToken = jwt.sign(
          { sub: token.sub },
          process.env.BACKEND_JWT_SECRET as string,
          { expiresIn: "15m" }
        );
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default-secret",
  events: {
    async signIn(message) {
      if (message.account?.provider === "google") {
        const { user } = message;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/internal/users/bootstrap`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_API_SECRET as string,
          },
          body: JSON.stringify({
            googleId: user.id,
            email: user.email,
            userName: user.name,
          }),
        });
      }
    },
  },
}
```

The `secret` line now prefers `NEXTAUTH_SECRET` (the conventional NextAuth name) but falls back to the existing `JWT_SECRET` value so a deployment that already has `JWT_SECRET` set keeps working unchanged until it's explicitly migrated to `NEXTAUTH_SECRET`. The `googleId`/`email`/`userName` keys in the bootstrap request body match exactly what `InternalBootstrapView.post` (Task 8) reads via `request.data.get("googleId")` etc.

- [ ] **Step 4: Add the new env vars to `apps/frontend/.env.development.local`**

Add these lines (keep the existing `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, `JWT_SECRET` as-is):

```
NEXT_PUBLIC_API_URL=https://localhost:4000
BACKEND_JWT_SECRET=dev-jwt-secret
INTERNAL_API_SECRET=dev-internal-secret
```

`BACKEND_JWT_SECRET` and `INTERNAL_API_SECRET` must exactly match the backend's `JWT_SECRET` and `INTERNAL_API_SECRET` (`dev-jwt-secret` / `dev-internal-secret` in Task 10's `docker-compose.yml` and Task 2's `.env.example` defaults — keep these in sync).

- [ ] **Step 5: Manual verification (no automated test — this touches live Google OAuth)**

Run the backend (`uv run --directory apps/backend gunicorn config.wsgi:application --bind 0.0.0.0:4000 --reload --certfile=certificates/localhost.pem --keyfile=certificates/localhost-key.pem`, once Task 13 adds the certs) and the frontend (`pnpm --dir apps/frontend run dev`), sign in with Google, and confirm in the backend logs that `POST /internal/users/bootstrap` was called once for a new account. Fully exercised in this plan's final end-to-end verification (Task 14) once Task 13's local HTTPS is in place.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/app/configs/auth.ts apps/frontend/next-auth.d.ts apps/frontend/package.json apps/frontend/pnpm-lock.yaml
git commit -m "feat(frontend): issue backend JWT via NextAuth session, bootstrap new users over HTTP"
```

(`.env.development.local` is git-ignored — nothing to add there.)

---

## Task 12: Frontend fetch call rewrites

**Files:**
- Modify: `apps/frontend/src/app/record/page.tsx`
- Modify: `apps/frontend/src/app/records/page.tsx`
- Delete: `apps/frontend/src/app/api/records/route.ts`, `apps/frontend/src/app/api/userInfo/route.ts`, `apps/frontend/src/app/api/users/[user_google_id]/records/route.ts`, `apps/frontend/src/app/api/users/[user_google_id]/categories/route.ts`

**Interfaces:**
- Consumes: `GET/POST /users/<user_google_id>/records`, `GET /users/<user_google_id>/categories` (Tasks 6-7), `session.apiToken` (Task 11)

- [ ] **Step 1: Update `apps/frontend/src/app/record/page.tsx`**

Replace the `fetchCategories` function body:

```typescript
    async function fetchCategories(googleId: string) {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${googleId}/categories`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
      });
      return await res.json().then((categories) => {
        setCategories(categories);
      });
    }
```

Replace the `addRecord` function's `fetch` call:

```typescript
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userGoogleId}/records`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
      });
```

(`credentials: "same-origin"` is removed — auth now travels via the `Authorization` header, not cookies.)

- [ ] **Step 2: Update `apps/frontend/src/app/records/page.tsx`**

Replace the `fetchRecords` function body:

```typescript
    async function fetchRecords() {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userGoogleId}/records`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${session?.apiToken}`,
        },
      });
      return setRecords(await res.json());
    }
```

`session` is already in scope (`const { data: session } = useSession();`) but isn't in `fetchRecords`'s `useEffect` dependency array yet — change `}, [userGoogleId]);` to `}, [userGoogleId, session]);` so a token refresh re-fetches with the new token.

- [ ] **Step 3: Re-grep for any other `/api/` fetch call sites before deleting the old routes**

```bash
grep -rn "fetch(" apps/frontend/src --include="*.tsx" --include="*.ts"
```

Expected: only the two call sites just edited, both pointing at `NEXT_PUBLIC_API_URL` now. If this turns up anything else, update it the same way before continuing.

- [ ] **Step 4: Delete the old Next.js API routes**

```bash
git rm -r apps/frontend/src/app/api/records apps/frontend/src/app/api/userInfo apps/frontend/src/app/api/users
```

Do NOT delete `apps/frontend/src/app/api/auth` — that's the NextAuth handler, which stays in the frontend.

- [ ] **Step 5: Remove the now-unused `@vercel/postgres` dependency and dead import**

```bash
pnpm remove @vercel/postgres --dir apps/frontend
```

Also remove the unused `import {sql} from "@vercel/postgres";` line from `apps/frontend/src/app/page.tsx` — dead code left over from before this refactor, unrelated to the routes just deleted.

`uuid`/`@types/uuid` become dead too at this point — their only import was the `import { v4 as uuidv4 } from 'uuid'` in the old `auth.ts`, which Task 11's rewrite already dropped. Confirm with `grep -rn "from ['\"]uuid['\"]" apps/frontend/src` (expect no output) and remove both: `pnpm remove uuid @types/uuid --dir apps/frontend`.

- [ ] **Step 6: Manual verification**

Run `pnpm --dir apps/frontend run lint` — expect it to pass with no references to the deleted files.

- [ ] **Step 7: Commit**

```bash
git add -A apps/frontend
git commit -m "feat(frontend): call the backend API instead of local Next.js route handlers"
```

---

## Task 13: Local dev HTTPS for the backend + env reorg + README

**Files:**
- Create: `apps/backend/certificates/` (copied dev certs)
- Modify: `apps/backend/.env.example`
- Modify: root `package.json` (add scripts)
- Modify: root `README.md`

**Interfaces:**
- Produces: backend dev server listening over HTTPS on `https://localhost:4000`, matching `NEXT_PUBLIC_API_URL=https://localhost:4000` from Task 11.

- [ ] **Step 1: Copy the existing frontend dev certs for the backend to use**

```bash
mkdir -p apps/backend/certificates
cp apps/frontend/certificates/localhost.pem apps/backend/certificates/localhost.pem
cp apps/frontend/certificates/localhost-key.pem apps/backend/certificates/localhost-key.pem
```

(Both certs are for `localhost` and aren't port-specific, so reusing them for the backend's different port is valid.)

- [ ] **Step 2: Add the root `package.json` scripts, now that `apps/backend` exists**

Update the root `package.json` created in Task 1:

```json
{
  "name": "bookkeeping",
  "private": true,
  "scripts": {
    "dev": "concurrently -n backend,frontend -c blue,green \"pnpm run dev:backend\" \"pnpm run dev:frontend\"",
    "dev:frontend": "pnpm --dir apps/frontend run dev",
    "dev:backend": "uv run --directory apps/backend gunicorn config.wsgi:application --bind 0.0.0.0:4000 --reload --certfile=certificates/localhost.pem --keyfile=certificates/localhost-key.pem",
    "build": "pnpm --dir apps/frontend run build",
    "lint": "pnpm --dir apps/frontend run lint"
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
```

`uv run --directory apps/backend` changes the effective working directory before running `gunicorn`, so the relative `certificates/...` paths resolve correctly regardless of where `pnpm run dev` itself was invoked from.

- [ ] **Step 3: Run both apps and confirm no mixed-content / CORS errors**

```bash
pnpm install
pnpm run dev
```

Open `https://localhost:3000`, open devtools, sign in with Google, and confirm: (a) no certificate warnings beyond the usual self-signed prompt (accept it for `localhost:4000` once, same as already done for `:3000`), (b) no CORS errors in the console, (c) the Network tab shows requests going to `https://localhost:4000/...`.

- [ ] **Step 4: Update the root `README.md`**

Rewrite the "Getting Started" and "Project Structure" sections to describe: `apps/frontend` (pnpm) and `apps/backend` (uv/Django) are fully independent projects; first-time setup needs `pnpm install` at root, `pnpm --dir apps/frontend install`, and `cd apps/backend && uv sync`; `pnpm run dev` starts both dev servers concurrently; a fresh backend needs a reachable Postgres and `uv run --directory apps/backend python manage.py migrate` (or just `docker compose up -d postgres backend`, which runs migrations automatically) before it will serve traffic; `docker compose up` runs Postgres + backend for local Docker-based dev; the full env var list is split across `apps/frontend/.env.example` and `apps/backend/.env.example`; and a "Deployment" section noting the frontend deploys to Vercel with **Root Directory** set to `apps/frontend`, while the backend deploys as a Docker container to any host.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/certificates apps/backend/.env.example package.json README.md
git commit -m "feat(backend): local dev HTTPS via gunicorn; wire up root dev scripts; update README"
```

---

## Task 14: Vercel Root Directory + final end-to-end verification

**Files:** none (configuration + verification only)

- [ ] **Step 1: Update the Vercel project's Root Directory**

In the Vercel dashboard for this project: Settings → General → Root Directory → set to `apps/frontend`. Save.

- [ ] **Step 2: Push a branch and confirm a Vercel preview deployment builds**

```bash
git push origin HEAD
```

Open the resulting PR's Vercel preview check and confirm the build succeeds from `apps/frontend`.

- [ ] **Step 3: Full local end-to-end walkthrough**

```bash
docker compose up --build -d   # postgres + backend (migrations run automatically)
pnpm run dev:frontend          # frontend on the host, HTTPS
```

- Visit `https://localhost:3000`, sign in with Google.
- Confirm (via `docker compose logs backend`) that `POST /internal/users/bootstrap` fired once and created a user + a "Food" category.
- Go to `/record`, confirm the category dropdown is populated (network request to `https://localhost:4000/users/<id>/categories`, 200).
- Submit a new record; confirm it POSTs to `https://localhost:4000/users/<id>/records` and redirects back to `/records` showing the new entry.
- In devtools, confirm zero CORS errors across the whole flow.

- [ ] **Step 4: Auth negative tests**

```bash
curl -i https://localhost:4000/records -k
curl -i https://localhost:4000/records -k -H "Authorization: Bearer not-a-real-token"
```

Expected: both return `401`.

- [ ] **Step 5: Full test suite + lint, one last time**

```bash
cd apps/backend && uv run pytest && cd ../..
pnpm --dir apps/frontend run lint
pnpm run build
```

Expected: all pass/succeed. (`uv run pytest` needs Postgres reachable — `docker compose up -d postgres` first if it isn't already running from Step 3.)

- [ ] **Step 6: Tear down**

```bash
docker compose down
```

No commit for this task — it's verification only, plus an external (Vercel dashboard) configuration change.

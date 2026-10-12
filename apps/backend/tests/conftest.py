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

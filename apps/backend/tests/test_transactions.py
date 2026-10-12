import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.helpers import auth_headers, make_user


@pytest.fixture
def deferred_category_fk(db):
    db.execute("ALTER TABLE records ALTER CONSTRAINT records_category_id_fkey DEFERRABLE INITIALLY DEFERRED")
    yield
    db.execute("ALTER TABLE records ALTER CONSTRAINT records_category_id_fkey NOT DEFERRABLE")


def test_a_failed_commit_is_not_reported_as_success(db, deferred_category_fk):
    make_user(db, "g1")
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/users/g1/records",
            json={"recordDate": "2026-01-05", "recordType": "income", "amount": 5, "categoryId": 999},
            headers=auth_headers("g1"),
        )
    assert response.status_code == 500
    assert db.execute("SELECT count(*) AS n FROM records").fetchone()["n"] == 0

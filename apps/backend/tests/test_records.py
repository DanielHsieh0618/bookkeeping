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


def test_user_records_post_accepts_income_without_a_category(client, db):
    user_id = make_user(db, "g1")
    response = client.post(
        "/users/g1/records",
        json={"recordDate": "2026-01-05", "recordType": "income", "amount": 100, "categoryId": None},
        headers=auth_headers("g1"),
    )
    assert response.status_code == 200
    record = db.execute("SELECT * FROM records").fetchone()
    assert record["user_id"] == user_id
    assert record["category_id"] is None
    listed = client.get("/users/g1/records", headers=auth_headers("g1")).json()
    assert listed[0]["category_id"] is None
    assert listed[0]["record_type"] == "income"

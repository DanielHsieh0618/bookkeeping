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


def test_bootstrap_works_without_a_unique_constraint_on_google_id(client, db):
    db.execute("ALTER TABLE users DROP CONSTRAINT users_google_id_key")
    try:
        first = client.post("/internal/users/bootstrap", json=BODY, headers=HEADERS)
        second = client.post("/internal/users/bootstrap", json=BODY, headers=HEADERS)
        users = db.execute("SELECT count(*) AS n FROM users").fetchone()["n"]
        categories = db.execute("SELECT count(*) AS n FROM categories").fetchone()["n"]
    finally:
        db.execute("DELETE FROM categories")
        db.execute("DELETE FROM users")
        db.execute("ALTER TABLE users ADD CONSTRAINT users_google_id_key UNIQUE (google_id)")
    assert first.status_code == 200
    assert second.status_code == 200
    assert (users, categories) == (1, 1)

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

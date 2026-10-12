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

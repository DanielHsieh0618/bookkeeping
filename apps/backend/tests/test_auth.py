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

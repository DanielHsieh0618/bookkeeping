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

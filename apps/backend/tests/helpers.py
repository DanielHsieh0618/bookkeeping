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

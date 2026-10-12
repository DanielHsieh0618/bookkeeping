import uuid
from decimal import Decimal

from psycopg import AsyncConnection


async def get_user_by_google_id(conn: AsyncConnection, google_id: str) -> dict | None:
    cur = await conn.execute(
        "SELECT user_id, google_id, email, user_name, uuid FROM users WHERE google_id = %s",
        (google_id,),
    )
    return await cur.fetchone()


async def bootstrap_user(conn: AsyncConnection, *, google_id: str, email: str, user_name: str) -> None:
    cur = await conn.execute(
        "INSERT INTO users (google_id, email, user_name, uuid) VALUES (%s, %s, %s, %s)"
        " ON CONFLICT (google_id) DO NOTHING RETURNING user_id",
        (google_id, email, user_name, str(uuid.uuid4())),
    )
    created = await cur.fetchone()
    if created is None:
        return
    await conn.execute(
        "INSERT INTO categories (user_id, category_name, category_icon) VALUES (%s, %s, %s)",
        (created["user_id"], "Food", "apple"),
    )


async def get_user_id_by_google_id(conn: AsyncConnection, google_id: str) -> int | None:
    cur = await conn.execute("SELECT user_id FROM users WHERE google_id = %s", (google_id,))
    row = await cur.fetchone()
    return row["user_id"] if row else None


async def list_categories(conn: AsyncConnection, user_id: int) -> list[dict]:
    cur = await conn.execute(
        "SELECT category_id, user_id, category_name, category_icon FROM categories"
        " WHERE user_id = %s ORDER BY category_id",
        (user_id,),
    )
    return await cur.fetchall()


async def list_records(conn: AsyncConnection, user_id: int | None = None) -> list[dict]:
    if user_id is None:
        cur = await conn.execute(
            "SELECT record_id, record_date, record_type, amount, category_id, user_id, description"
            " FROM records ORDER BY record_id"
        )
    else:
        cur = await conn.execute(
            "SELECT record_id, record_date, record_type, amount, category_id, user_id, description"
            " FROM records WHERE user_id = %s ORDER BY record_id",
            (user_id,),
        )
    return await cur.fetchall()


async def create_record(
    conn: AsyncConnection,
    *,
    record_date: str,
    record_type: str,
    amount: Decimal,
    category_id: int | None,
    user_id: int,
    description: str,
) -> None:
    await conn.execute(
        "INSERT INTO records (record_date, record_type, amount, category_id, user_id, description)"
        " VALUES (%s, %s, %s, %s, %s, %s)",
        (record_date, record_type, amount, category_id, user_id, description),
    )

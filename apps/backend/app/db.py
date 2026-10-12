from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import Request
from psycopg import AsyncConnection
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def create_pool(database_url: str) -> AsyncConnectionPool:
    return AsyncConnectionPool(
        database_url,
        min_size=1,
        max_size=5,
        open=False,
        kwargs={"row_factory": dict_row},
    )


async def apply_schema(pool: AsyncConnectionPool) -> None:
    async with pool.connection() as conn:
        await conn.execute(SCHEMA_PATH.read_text())


async def get_conn(request: Request) -> AsyncIterator[AsyncConnection]:
    async with request.app.state.pool.connection() as conn:
        yield conn

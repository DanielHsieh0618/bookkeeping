from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import apply_schema, create_pool
from .routers import categories, internal, records, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = create_pool(get_settings().database_url)
    try:
        await pool.open(wait=True, timeout=30)
        await apply_schema(pool)
        app.state.pool = pool
        yield
    finally:
        await pool.close()


app = FastAPI(title="Bookkeeping API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[get_settings().frontend_url],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(internal.router)
app.include_router(categories.router)
app.include_router(records.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

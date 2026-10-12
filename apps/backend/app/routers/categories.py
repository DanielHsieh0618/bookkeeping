from fastapi import APIRouter

from .. import services
from ..deps import Conn, OwnerUserId
from ..schemas import CategoryOut

router = APIRouter(tags=["categories"])


@router.get("/users/{user_google_id}/categories", response_model=list[CategoryOut])
async def list_user_categories(user_id: OwnerUserId, conn: Conn):
    return await services.list_categories(conn, user_id)

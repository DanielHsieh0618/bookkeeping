from typing import Annotated

from fastapi import Depends, HTTPException, status
from psycopg import AsyncConnection

from . import services
from .auth import get_current_google_id, require_owner
from .db import get_conn

CurrentGoogleId = Annotated[str, Depends(get_current_google_id)]
# scope="function" commits before the response is sent, so a failed commit is a 500, never a false 200.
Conn = Annotated[AsyncConnection, Depends(get_conn, scope="function")]


async def get_owner_user_id(google_id: Annotated[str, Depends(require_owner)], conn: Conn) -> int:
    user_id = await services.get_user_id_by_google_id(conn, google_id)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_id


OwnerUserId = Annotated[int, Depends(get_owner_user_id)]

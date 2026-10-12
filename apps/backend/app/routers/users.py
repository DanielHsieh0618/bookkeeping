from fastapi import APIRouter, HTTPException, status

from .. import services
from ..deps import Conn, CurrentGoogleId
from ..schemas import UserOut

router = APIRouter(tags=["users"])


@router.get("/userInfo", response_model=UserOut)
async def user_info(google_id: CurrentGoogleId, conn: Conn):
    user = await services.get_user_by_google_id(conn, google_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

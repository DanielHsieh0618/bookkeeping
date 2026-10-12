from fastapi import APIRouter, Depends

from .. import services
from ..auth import require_internal_secret
from ..deps import Conn
from ..schemas import BootstrapUser, Message

router = APIRouter(
    prefix="/internal",
    tags=["internal"],
    dependencies=[Depends(require_internal_secret)],
)


@router.post("/users/bootstrap", response_model=Message)
async def bootstrap(body: BootstrapUser, conn: Conn):
    await services.bootstrap_user(conn, google_id=body.googleId, email=body.email, user_name=body.userName)
    return {"message": "ok"}

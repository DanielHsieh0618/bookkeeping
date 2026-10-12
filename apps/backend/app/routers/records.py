from fastapi import APIRouter, Depends

from .. import services
from ..auth import get_current_google_id
from ..deps import Conn, OwnerUserId
from ..schemas import GlobalRecordCreate, Message, RecordCreate, RecordOut

router = APIRouter(tags=["records"])


@router.get("/users/{user_google_id}/records", response_model=list[RecordOut])
async def list_user_records(user_id: OwnerUserId, conn: Conn):
    return await services.list_records(conn, user_id)


@router.post("/users/{user_google_id}/records", response_model=Message)
async def create_user_record(body: RecordCreate, user_id: OwnerUserId, conn: Conn):
    await services.create_record(
        conn,
        record_date=body.recordDate,
        record_type=body.recordType,
        amount=body.amount,
        category_id=body.categoryId,
        user_id=user_id,
        description=body.description,
    )
    return {"message": "Success"}


@router.get("/records", response_model=list[RecordOut], dependencies=[Depends(get_current_google_id)])
async def list_all_records(conn: Conn):
    return await services.list_records(conn)


@router.post("/records", response_model=Message, dependencies=[Depends(get_current_google_id)])
async def create_record(body: GlobalRecordCreate, conn: Conn):
    await services.create_record(
        conn,
        record_date=body.recordDate,
        record_type=body.recordType,
        amount=body.amount,
        category_id=body.categoryId,
        user_id=body.userId,
        description=body.description,
    )
    return {"message": "Success"}

import secrets
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

SettingsDep = Annotated[Settings, Depends(get_settings)]

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_google_id(
    settings: SettingsDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> str:
    if credentials is None:
        raise _unauthorized("Authentication credentials were not provided.")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise _unauthorized("Invalid token") from exc
    sub = payload.get("sub")
    if not sub:
        raise _unauthorized("Invalid token")
    return sub


async def require_owner(
    user_google_id: str,
    google_id: Annotated[str, Depends(get_current_google_id)],
) -> str:
    if user_google_id != google_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return google_id


async def require_internal_secret(
    settings: SettingsDep,
    x_internal_secret: Annotated[str | None, Header()] = None,
) -> None:
    expected = settings.internal_api_secret.encode()
    if x_internal_secret is None or not secrets.compare_digest(x_internal_secret.encode(), expected):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

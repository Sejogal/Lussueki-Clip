import hashlib
from datetime import datetime, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import get_connection
from schemas import (
    FavoriteRequest,
    FavoriteResponse,
    HistoryResponse,
    UserResponse,
    WatchRequest,
    WatchResponse,
)
from security import JWT_ALGORITHM, JWT_SECRET

bearer_scheme = HTTPBearer(auto_error=False)

users_router = APIRouter(prefix="/users/me", tags=["Usuário"])


def current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> int:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


@users_router.get("", response_model=UserResponse)
def get_profile(user_id: int = Depends(current_user_id)) -> UserResponse:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT id, name, email, plan, login_count, last_login_at, created_at FROM users WHERE id = %s",
            (user_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return UserResponse(**dict(row))


@users_router.get("/history", response_model=list[HistoryResponse])
def get_history(user_id: int = Depends(current_user_id)) -> list[HistoryResponse]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, content_key, title, category, source_url, position_seconds, "
            "duration_seconds, view_count, last_watched_at "
            "FROM watch_history WHERE user_id = %s ORDER BY last_watched_at DESC",
            (user_id,),
        ).fetchall()
    return [HistoryResponse(**dict(row)) for row in rows]


@users_router.get("/continue-watching", response_model=list[HistoryResponse])
def get_continue_watching(user_id: int = Depends(current_user_id)) -> list[HistoryResponse]:
    """Itens pra fileira 'Continuar assistindo': mais recentes primeiro,
    excluindo o que já passou de 95% assistido (evita mostrar algo que
    só falta o encerramento/créditos como se estivesse pausado no meio)."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, content_key, title, category, source_url, position_seconds,
                   duration_seconds, view_count, last_watched_at
            FROM watch_history
            WHERE user_id = %s
              AND (duration_seconds IS NULL OR position_seconds < duration_seconds * 0.95)
            ORDER BY last_watched_at DESC
            LIMIT 20
            """,
            (user_id,),
        ).fetchall()
    return [HistoryResponse(**dict(row)) for row in rows]


@users_router.post("/history", response_model=WatchResponse)
def register_watch(payload: WatchRequest, user_id: int = Depends(current_user_id)) -> WatchResponse:
    now = datetime.now(timezone.utc).isoformat()
    content_key = payload.content_key or hashlib.sha256(payload.source_url.encode()).hexdigest()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO watch_history
                (user_id, content_key, title, category, source_url,
                 position_seconds, duration_seconds, view_count, last_watched_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1, %s)
            ON CONFLICT(user_id, content_key) DO UPDATE SET
                title = excluded.title,
                category = excluded.category,
                source_url = excluded.source_url,
                position_seconds = excluded.position_seconds,
                duration_seconds = COALESCE(excluded.duration_seconds, watch_history.duration_seconds),
                view_count = watch_history.view_count + CASE WHEN %s THEN 1 ELSE 0 END,
                last_watched_at = excluded.last_watched_at
            """,
            (
                user_id,
                content_key,
                payload.title,
                payload.category,
                payload.source_url,
                payload.position_seconds,
                payload.duration_seconds,
                now,
                payload.count_view,
            ),
        )
        row = connection.execute(
            "SELECT content_key, title, category, source_url, position_seconds, "
            "duration_seconds, view_count, last_watched_at "
            "FROM watch_history WHERE user_id = %s AND content_key = %s",
            (user_id, content_key),
        ).fetchone()
    return WatchResponse(**dict(row))


@users_router.get("/favorites", response_model=list[FavoriteResponse])
def get_favorites(user_id: int = Depends(current_user_id)) -> list[FavoriteResponse]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT content_key, title, category, source_url, poster_url, added_at "
            "FROM favorites WHERE user_id = %s ORDER BY added_at DESC",
            (user_id,),
        ).fetchall()
    return [FavoriteResponse(**dict(row)) for row in rows]


@users_router.post("/favorites", response_model=FavoriteResponse)
def add_favorite(payload: FavoriteRequest, user_id: int = Depends(current_user_id)) -> FavoriteResponse:
    now = datetime.now(timezone.utc).isoformat()
    content_key = payload.content_key or hashlib.sha256(payload.source_url.encode()).hexdigest()
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO favorites
                (user_id, content_key, title, category, source_url, poster_url, added_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(user_id, content_key) DO UPDATE SET
                title = excluded.title,
                category = excluded.category,
                source_url = excluded.source_url,
                poster_url = excluded.poster_url
            """,
            (user_id, content_key, payload.title, payload.category, payload.source_url, payload.poster_url, now),
        )
        row = connection.execute(
            "SELECT content_key, title, category, source_url, poster_url, added_at "
            "FROM favorites WHERE user_id = %s AND content_key = %s",
            (user_id, content_key),
        ).fetchone()
    return FavoriteResponse(**dict(row))


@users_router.delete("/favorites/{content_key}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(content_key: str, user_id: int = Depends(current_user_id)) -> None:
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM favorites WHERE user_id = %s AND content_key = %s",
            (user_id, content_key),
        )

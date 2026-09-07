"""
models.py

Camada de modelo: representa `User` e `WatchHistoryEntry` como objetos
Python de verdade e concentra toda a lógica de acesso a esses dados.
Fora daqui, nada deveria escrever SQL diretamente pra mexer em usuários
ou histórico — sempre passe por essas funções.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from database import get_connection

# ── Planos de usuário ────────────────────────────────────────────────
FREE = "free"
PREMIUM = "premium"
SUPER_PREMIUM = "super_premium"
PLANS = (FREE, PREMIUM, SUPER_PREMIUM)

# Ordem de "nível" dos planos — útil pra checar acesso do tipo "esse
# recurso exige premium ou superior", sem precisar comparar strings.
_PLAN_RANK = {FREE: 0, PREMIUM: 1, SUPER_PREMIUM: 2}


def plan_at_least(plan: str, minimum: str) -> bool:
    """Ex: plan_at_least(user.plan, PREMIUM) -> True se for premium ou super_premium."""
    return _PLAN_RANK.get(plan, 0) >= _PLAN_RANK.get(minimum, 0)


# ── Erros específicos do domínio ─────────────────────────────────────
class EmailAlreadyExistsError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


# ── Hash de senha ────────────────────────────────────────────────────
# PBKDF2-HMAC-SHA256 com salt aleatório, usando só a biblioteca padrão
# (sem depender de bcrypt/passlib). 200 mil iterações é um valor
# razoável em 2026 — ajuste pra cima se seu servidor aguentar sem
# impactar o tempo de login perceptivelmente.
_HASH_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), _HASH_ITERATIONS
    )
    return f"pbkdf2_sha256${_HASH_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, hex_digest = password_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt), int(iterations)
        )
        # compare_digest evita timing attack (comparação normal de
        # strings vaza quanto tempo leva pra achar a primeira diferença).
        return hmac.compare_digest(digest.hex(), hex_digest)
    except (ValueError, AttributeError):
        return False


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── User ─────────────────────────────────────────────────────────────
@dataclass
class User:
    id: int
    name: str
    email: str
    plan: str
    login_count: int
    last_login_at: Optional[str]
    created_at: str

    @classmethod
    def _from_row(cls, row: sqlite3.Row) -> "User":
        return cls(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            plan=row["plan"],
            login_count=row["login_count"],
            last_login_at=row["last_login_at"],
            created_at=row["created_at"],
        )

    @property
    def is_premium(self) -> bool:
        """True pra premium OU super_premium (é 'pelo menos premium')."""
        return plan_at_least(self.plan, PREMIUM)

    @property
    def is_super_premium(self) -> bool:
        return self.plan == SUPER_PREMIUM


def create_user(name: str, email: str, password: str, plan: str = FREE) -> User:
    if plan not in PLANS:
        raise ValueError(f"Plano inválido: {plan!r}. Use um de {PLANS}.")

    email_normalized = email.strip().lower()
    password_hash = hash_password(password)
    created_at = _utcnow_iso()

    with get_connection() as connection:
        try:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, password_hash, plan, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name.strip(), email_normalized, password_hash, plan, created_at),
            )
        except sqlite3.IntegrityError as err:
            raise EmailAlreadyExistsError(
                f"Já existe um usuário com o email {email_normalized!r}"
            ) from err

        new_id = cursor.lastrowid

    return get_user_by_id(new_id)  # type: ignore[arg-type]


def get_user_by_id(user_id: int) -> User:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise UserNotFoundError(f"Usuário {user_id} não encontrado")
    return User._from_row(row)


def get_user_by_email(email: str) -> Optional[User]:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()
    return User._from_row(row) if row else None


def authenticate(email: str, password: str) -> User:
    """Verifica email/senha e, se corretos, registra o login (incrementa
    login_count e atualiza last_login_at) antes de retornar o usuário."""
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?", (email.strip().lower(),)
        ).fetchone()

        if row is None or not verify_password(password, row["password_hash"]):
            raise InvalidCredentialsError("Email ou senha inválidos")

        connection.execute(
            "UPDATE users SET login_count = login_count + 1, last_login_at = ? WHERE id = ?",
            (_utcnow_iso(), row["id"]),
        )
        updated_row = connection.execute(
            "SELECT * FROM users WHERE id = ?", (row["id"],)
        ).fetchone()

    return User._from_row(updated_row)


def set_user_plan(user_id: int, plan: str) -> User:
    if plan not in PLANS:
        raise ValueError(f"Plano inválido: {plan!r}. Use um de {PLANS}.")

    with get_connection() as connection:
        connection.execute("UPDATE users SET plan = ? WHERE id = ?", (plan, user_id))

    return get_user_by_id(user_id)


# ── Watch history / "Continuar assistindo" ───────────────────────────
@dataclass
class WatchHistoryEntry:
    id: int
    user_id: int
    content_key: str
    title: str
    category: Optional[str]
    source_url: str
    position_seconds: int
    duration_seconds: Optional[int]
    view_count: int
    last_watched_at: str

    @classmethod
    def _from_row(cls, row: sqlite3.Row) -> "WatchHistoryEntry":
        return cls(
            id=row["id"],
            user_id=row["user_id"],
            content_key=row["content_key"],
            title=row["title"],
            category=row["category"],
            source_url=row["source_url"],
            position_seconds=row["position_seconds"],
            duration_seconds=row["duration_seconds"],
            view_count=row["view_count"],
            last_watched_at=row["last_watched_at"],
        )

    @property
    def progress_ratio(self) -> Optional[float]:
        """Fração assistida (0.0 a 1.0), ou None se não soubermos a
        duração total ainda (ex: primeira vez que o progresso foi salvo,
        antes do player reportar a duração)."""
        if not self.duration_seconds:
            return None
        return max(0.0, min(1.0, self.position_seconds / self.duration_seconds))

    @property
    def is_finished(self) -> bool:
        """Considera 'terminado' a partir de 95% assistido — evita achar
        que algo não foi visto só porque faltam os créditos finais."""
        ratio = self.progress_ratio
        return ratio is not None and ratio >= 0.95


def upsert_watch_progress(
    user_id: int,
    content_key: str,
    title: str,
    source_url: str,
    position_seconds: int,
    duration_seconds: Optional[int] = None,
    category: Optional[str] = None,
) -> WatchHistoryEntry:
    """Cria ou atualiza o progresso de um conteúdo pro usuário. Chame
    periodicamente durante a reprodução (ex: a cada 10-15s) e ao
    pausar/sair do player.

    `content_key` deve ser um identificador estável do conteúdo (ex: a
    mesma URL de nível 1 usada como chave no app — a mesma lógica já
    usada pros favoritos)."""
    now = _utcnow_iso()

    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO watch_history
                (user_id, content_key, title, category, source_url,
                 position_seconds, duration_seconds, view_count, last_watched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(user_id, content_key) DO UPDATE SET
                title = excluded.title,
                category = excluded.category,
                source_url = excluded.source_url,
                position_seconds = excluded.position_seconds,
                duration_seconds = COALESCE(excluded.duration_seconds, watch_history.duration_seconds),
                view_count = watch_history.view_count + 1,
                last_watched_at = excluded.last_watched_at
            """,
            (user_id, content_key, title, category, source_url, position_seconds, duration_seconds, now),
        )
        row = connection.execute(
            "SELECT * FROM watch_history WHERE user_id = ? AND content_key = ?",
            (user_id, content_key),
        ).fetchone()

    return WatchHistoryEntry._from_row(row)


def get_continue_watching(user_id: int, limit: int = 20) -> list[WatchHistoryEntry]:
    """Itens pra fileira 'Continuar assistindo': mais recentes primeiro,
    excluindo o que já foi terminado (>=95% assistido)."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM watch_history
            WHERE user_id = ?
              AND (duration_seconds IS NULL OR position_seconds < duration_seconds * 0.95)
            ORDER BY last_watched_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()

    return [WatchHistoryEntry._from_row(row) for row in rows]


def get_watch_history(user_id: int, limit: int = 50) -> list[WatchHistoryEntry]:
    """Histórico completo (inclui itens já terminados), mais recente primeiro."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM watch_history
            WHERE user_id = ?
            ORDER BY last_watched_at DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()

    return [WatchHistoryEntry._from_row(row) for row in rows]


def delete_watch_history_entry(user_id: int, content_key: str) -> None:
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM watch_history WHERE user_id = ? AND content_key = ?",
            (user_id, content_key),
        )
"""
database.py

Conexão com PostgreSQL via psycopg2, com pool de conexões.

IMPORTANTE — diferenças em relação à versão SQLite anterior:
- Placeholders de SQL mudam de "?" para "%s" em todo lugar que executa
  queries (auth.py, users.py). Isso é sintaxe do driver, não tem como
  contornar.
- `cursor.lastrowid` não existe no psycopg2 — troque por `RETURNING id`
  na query e leia com `cursor.fetchone()["id"]`.
- Para minimizar mudanças no resto do código, `get_connection()` ainda
  devolve um objeto com `.execute(sql, params)` funcionando igual ao
  sqlite3.Connection original (veja `_ConnectionCompat` abaixo) — então
  a maior parte do auth.py/users.py não muda de estrutura, só a sintaxe
  das queries.
"""
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool

DATABASE_URL = os.getenv("LK_CLIP_DATABASE_URL") or os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "Defina a variável de ambiente LK_CLIP_DATABASE_URL (ou DATABASE_URL) "
        "com a string de conexão do PostgreSQL, ex:\n"
        "  postgresql://usuario:senha@host:5432/lk_clip"
    )

_POOL_MIN = int(os.getenv("LK_CLIP_DB_POOL_MIN", "1"))
_POOL_MAX = int(os.getenv("LK_CLIP_DB_POOL_MAX", "10"))

_pool = psycopg2.pool.ThreadedConnectionPool(_POOL_MIN, _POOL_MAX, dsn=DATABASE_URL)


class _ConnectionCompat:
    """Camada fina de compatibilidade: dá ao psycopg2 os mesmos métodos
    de conveniência que o sqlite3.Connection tinha (`.execute()` direto
    na conexão, sem precisar abrir um cursor manualmente toda vez). Isso
    evita reescrever a estrutura de auth.py/users.py inteira — só a
    sintaxe das queries (?  -> %s) e o lastrowid (-> RETURNING) mudam.

    Usa `psycopg2.extras.DictCursor`, que — assim como o sqlite3.Row —
    permite tanto `row["coluna"]` quanto `row[0]` no mesmo objeto, então
    o código que já acessa linhas por índice (auth.py) e o que usa
    `dict(row)` (users.py) continuam funcionando sem mudanças.
    """

    def __init__(self, raw_connection):
        self._raw = raw_connection

    def execute(self, sql: str, params=()):
        cursor = self._raw.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cursor.execute(sql, params)
        return cursor

    def executescript(self, sql: str) -> None:
        cursor = self._raw.cursor()
        cursor.execute(sql)

    def commit(self) -> None:
        self._raw.commit()

    def rollback(self) -> None:
        self._raw.rollback()


@contextmanager
def get_connection():
    """Pega uma conexão do pool. Ao sair do `with` sem erro, faz commit;
    se houve exceção, faz rollback — e em qualquer caso devolve a conexão
    ao pool (nunca fecha de verdade, só libera pra reuso)."""
    raw_connection = _pool.getconn()
    try:
        yield _ConnectionCompat(raw_connection)
        raw_connection.commit()
    except Exception:
        raw_connection.rollback()
        raise
    finally:
        _pool.putconn(raw_connection)


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'premium', 'super_premium')),
                login_count INTEGER NOT NULL DEFAULT 0,
                last_login_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS watch_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content_key TEXT NOT NULL,
                title TEXT NOT NULL,
                category TEXT,
                source_url TEXT NOT NULL,
                position_seconds INTEGER NOT NULL DEFAULT 0,
                duration_seconds INTEGER,
                view_count INTEGER NOT NULL DEFAULT 1,
                last_watched_at TEXT NOT NULL,
                UNIQUE(user_id, content_key)
            );

            -- Acelera "últimos assistidos por esse usuário, mais recentes
            -- primeiro" (fileira "Continuar assistindo").
            CREATE INDEX IF NOT EXISTS idx_watch_history_user_recent
                ON watch_history(user_id, last_watched_at DESC);

            -- Postgres suporta ADD COLUMN IF NOT EXISTS nativamente —
            -- diferente do SQLite, não precisa de checagem manual pra
            -- migrar um banco já existente com o schema antigo.
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
            ALTER TABLE watch_history
                ADD COLUMN IF NOT EXISTS position_seconds INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE watch_history
                ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
            """
        )

from datetime import datetime, timezone

import psycopg2

from fastapi import APIRouter, Depends, HTTPException, status

from database import get_connection
from routes.users import current_user_id
from schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse, UserUpdateRequest
from security import create_access_token, hash_password, verify_password

auth_router = APIRouter(prefix="/auth", tags=["Usuários"])


def _user_response(row) -> UserResponse:
	return UserResponse(
		id=row["id"],
		name=row["name"],
		email=row["email"],
		plan=row["plan"],
		login_count=row["login_count"],
		last_login_at=row["last_login_at"],
		created_at=row["created_at"],
	)


@auth_router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@auth_router.post("/registo", response_model=UserResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def register(payload: RegisterRequest) -> UserResponse:
	now = datetime.now(timezone.utc).isoformat()
	with get_connection() as connection:
		existing = connection.execute("SELECT id FROM users WHERE email = %s", (payload.email,)).fetchone()
		if existing:
			raise HTTPException(status_code=409, detail="Este email já está registado")

		try:
			cursor = connection.execute(
				"""
				INSERT INTO users (name, email, password_hash, login_count, created_at)
				VALUES (%s, %s, %s, 0, %s)
				RETURNING id
				""",
				(payload.name, payload.email, hash_password(payload.password), now),
			)
			new_id = cursor.fetchone()["id"]
		except psycopg2.IntegrityError:
			raise HTTPException(status_code=409, detail="Este email j\u00e1 est\u00e1 registado") from None

		row = connection.execute(
			"SELECT id, name, email, plan, login_count, last_login_at, created_at FROM users WHERE id = %s",
			(new_id,),
		).fetchone()
	return _user_response(row)


@auth_router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest) -> AuthResponse:
	now = datetime.now(timezone.utc).isoformat()
	with get_connection() as connection:
		row = connection.execute(
			"SELECT id, name, email, password_hash, plan, login_count, last_login_at, created_at "
			"FROM users WHERE email = %s",
			(payload.email,),
		).fetchone()
		if not row or not verify_password(payload.password, row["password_hash"]):
			raise HTTPException(status_code=401, detail="Email ou senha inválidos")

		connection.execute(
			"UPDATE users SET login_count = login_count + 1, last_login_at = %s WHERE id = %s",
			(now, row["id"]),
		)
		user = UserResponse(
			id=row["id"],
			name=row["name"],
			email=row["email"],
			plan=row["plan"],
			login_count=row["login_count"] + 1,
			last_login_at=now,
			created_at=row["created_at"],
		)
	return AuthResponse(access_token=create_access_token(row["id"]), user=user)


@auth_router.patch("/atualizar", response_model=UserResponse, status_code=status.HTTP_200_OK)
def atualizar_usuario(payload: UserUpdateRequest, user_id: int = Depends(current_user_id)) -> UserResponse:
	"""Atualiza nome e/ou senha da conta autenticada."""
	with get_connection() as connection:
		row = connection.execute(
			"SELECT id, name, email, password_hash, plan, login_count, last_login_at, created_at "
			"FROM users WHERE id = %s",
			(user_id,),
		).fetchone()
		if not row:
			raise HTTPException(status_code=404, detail="Usuário não encontrado")

		if payload.name is not None and payload.password is not None:
			connection.execute(
				"UPDATE users SET name = %s, password_hash = %s WHERE id = %s",
				(payload.name, hash_password(payload.password), user_id),
			)
		elif payload.name is not None:
			connection.execute("UPDATE users SET name = %s WHERE id = %s", (payload.name, user_id))
		else:
			connection.execute(
				"UPDATE users SET password_hash = %s WHERE id = %s",
				(hash_password(payload.password), user_id),
			)
		row = connection.execute(
			"SELECT id, name, email, plan, login_count, last_login_at, created_at FROM users WHERE id = %s",
			(user_id,),
		).fetchone()
	return _user_response(row)

@auth_router.delete("/delete/{user_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def delete_user(user_id: int) -> None:
	with get_connection() as connection:
		connection.execute(
			"DELETE FROM users WHERE id = %s",
			(user_id,),
		)


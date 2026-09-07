import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes.auth import auth_router
from routes.users import users_router


@asynccontextmanager
async def lifespan(app: FastAPI):
	# @app.on_event("startup") é depreciado desde o FastAPI 0.93 — o
	# padrão atual é este context manager. Tudo antes do `yield` roda no
	# start; depois do `yield` rodaria no shutdown (não precisamos de
	# nada lá por enquanto, já que get_connection() devolve as conexões
	# ao pool sozinho a cada requisição).
	init_db()
	yield


app = FastAPI(title="LUSSUEKI-CLIP API", version="1.0.0", lifespan=lifespan)

allowed_origins = [
	origin.strip()
	for origin in os.getenv(
		"LK_CLIP_ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:19006"
	).split(",")
	if origin.strip()
]

app.add_middleware(
	CORSMiddleware,
	allow_origins=allowed_origins,
	allow_credentials=False,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)


@app.get("/health", tags=["Sistema"])
def health() -> dict[str, str]:
	return {"status": "ok"}
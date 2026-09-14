from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Plan = Literal["free", "premium", "super_premium"]


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("O nome deve ter pelo menos 2 caracteres")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=160)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    plan: Plan
    login_count: int
    last_login_at: str | None
    created_at: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class WatchRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    source_url: str = Field(min_length=1, max_length=2000)
    category: str | None = Field(default=None, max_length=80)
    content_key: str | None = Field(default=None, max_length=300)
    # Progresso da reprodução — envie periodicamente durante o play (ex:
    # a cada 10-15s) e ao pausar/sair do player.
    position_seconds: int = Field(default=0, ge=0)
    duration_seconds: int | None = Field(default=None, ge=1)
    count_view: bool = True

    @field_validator("title", "source_url", "category", "content_key")
    @classmethod
    def strip_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("O campo n\u00e3o pode estar vazio")
        return value


class WatchResponse(BaseModel):
    content_key: str
    title: str
    category: str | None
    source_url: str
    position_seconds: int
    duration_seconds: int | None
    view_count: int
    last_watched_at: str


class HistoryResponse(WatchResponse):
    id: int


class FavoriteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    source_url: str = Field(min_length=1, max_length=2000)
    category: str | None = Field(default=None, max_length=80)
    poster_url: str | None = Field(default=None, max_length=2000)
    content_key: str | None = Field(default=None, max_length=300)


class FavoriteResponse(BaseModel):
    content_key: str
    title: str
    category: str | None
    source_url: str
    poster_url: str | None
    added_at: str

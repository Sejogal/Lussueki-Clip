import os
import sys
import tempfile
import unittest
from pathlib import Path

os.environ["LK_CLIP_JWT_SECRET"] = "test-secret-for-local-tests-32-bytes"
TEST_DATABASE = Path(tempfile.gettempdir()) / "lk_clip_api_tests.db"
os.environ["LK_CLIP_DATABASE"] = str(TEST_DATABASE)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from database import get_connection, init_db
from routes.auth import login, register
from routes.users import current_user_id, get_history, register_watch
from schemas import LoginRequest, RegisterRequest, WatchRequest


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        init_db()
        with get_connection() as connection:
            connection.execute("DELETE FROM watch_history")
            connection.execute("DELETE FROM users")

    def test_register_login_and_history(self) -> None:
        user = register(
            RegisterRequest(
                name="  Ana Silva  ",
                email="ANA@EXAMPLE.COM",
                password="password123",
            )
        )
        self.assertEqual(user.name, "Ana Silva")
        self.assertEqual(user.email, "ana@example.com")
        self.assertEqual(user.login_count, 0)

        with self.assertRaises(HTTPException) as duplicate:
            register(RegisterRequest(name="Ana", email="ana@example.com", password="password123"))
        self.assertEqual(duplicate.exception.status_code, 409)

        with self.assertRaises(HTTPException) as invalid_login:
            login(LoginRequest(email="ana@example.com", password="wrong-password"))
        self.assertEqual(invalid_login.exception.status_code, 401)

        auth = login(LoginRequest(email="ana@example.com", password="password123"))
        self.assertEqual(auth.user.login_count, 1)
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=auth.access_token)
        user_id = current_user_id(credentials)
        self.assertEqual(user_id, user.id)

        first = register_watch(
            WatchRequest(title="Filme", category="Drama", source_url="https://example.com/movie"), user_id
        )
        second = register_watch(
            WatchRequest(title="Filme", category="Drama", source_url="https://example.com/movie"), user_id
        )
        self.assertEqual(first.view_count, 1)
        self.assertEqual(second.view_count, 2)
        self.assertEqual(len(get_history(user_id)), 1)

    def test_invalid_token_is_rejected(self) -> None:
        with self.assertRaises(HTTPException) as invalid_token:
            current_user_id(HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid-token"))
        self.assertEqual(invalid_token.exception.status_code, 401)

    def test_invalid_email_and_blank_title_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            RegisterRequest(name="Ana", email="not-an-email", password="password123")
        with self.assertRaises(ValueError):
            WatchRequest(title="   ", source_url="https://example.com/movie")


if __name__ == "__main__":
    unittest.main()

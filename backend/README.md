# LK-CLIP API

## Executar

No PowerShell, dentro de `backend`:

```powershell
./venv/Scripts/Activate.ps1
$env:LK_CLIP_JWT_SECRET = "gere-um-segredo-longo-e-aleatorio"
pip install -r requirements.txt
uvicorn main:app --reload
```

A API fica dispon\u00edvel em `http://127.0.0.1:8000` e a documenta\u00e7\u00e3o interativa em `/docs`.

Para permitir um frontend web externo, defina `LK_CLIP_ALLOWED_ORIGINS` com as origens separadas por v\u00edrgula. O CORS n\u00e3o aceita `*` por padr\u00e3o.

## Rotas principais

- `POST /auth/register` — cria uma conta.
- `POST /auth/login` — devolve `access_token` e incrementa `login_count`.
- `GET /users/me` — devolve o perfil; requer `Authorization: Bearer <token>`.
- `GET /users/me/history` — lista o hist\u00f3rico.
- `POST /users/me/history` — cria ou atualiza um item e incrementa `view_count`.

Exemplo de registo:

```json
{
  "name": "Ana Silva",
  "email": "ana@example.com",
  "password": "uma-senha-com-8-caracteres"
}
```

## Testes

```powershell
$env:LK_CLIP_JWT_SECRET = "test-secret-with-at-least-32-bytes"
python -m unittest discover -s tests -v
```

## Favoritos e retomada

- `GET /users/me/continue-watching` lista os itens recentes ainda nao concluidos.
- `GET /users/me/favorites` lista favoritos sincronizados.
- `POST /users/me/favorites` adiciona ou atualiza um favorito.
- `DELETE /users/me/favorites/{content_key}` remove um favorito.

O app Expo usa `EXPO_PUBLIC_LK_CLIP_API_URL=http://IP_DO_COMPUTADOR:8000`.
Em celular fisico, inicie a API com `--host 0.0.0.0` e mantenha computador e celular na mesma rede Wi-Fi.

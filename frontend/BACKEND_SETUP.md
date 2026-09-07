# Conexão com o backend

Crie `frontend/.env` a partir de `.env.example` e informe a URL alcançável pelo app:

```env
EXPO_PUBLIC_LK_CLIP_API_URL=http://192.168.1.100:8000
```

Para testar no navegador no mesmo computador, use `http://127.0.0.1:8000` e inicie o backend com a origem permitida:

```powershell
$env:LK_CLIP_ALLOWED_ORIGINS = "http://localhost:8081,http://localhost:19006"
python -m uvicorn main:app --reload
```

Para Android/iOS físico, use o IP LAN do computador, inicie o backend aceitando conexões externas e libere a porta 8000 no firewall:

```powershell
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Depois de criar ou alterar `.env`, reinicie o Expo com limpeza de cache:

```powershell
npx expo start --clear
```

No app, toque em **Entrar**, crie uma conta e inicie um vídeo. Quando o vídeo alcançar o estado pronto para reprodução, o app envia `POST /users/me/history` com o token guardado no `AsyncStorage`.

O histórico armazena a URL original aberta pelo usuário e uma chave estável derivada dessa URL e do título do episódio; ele não depende da URL final resolvida pelo player.

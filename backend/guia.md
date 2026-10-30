# Guia: publicar conteúdo via Cloudflare

Este guia explica como ligar uma origem externa (Cloudflare Pages, Workers, ou
qualquer host que sirva ficheiros estáticos publicamente) ao app, para que
categorias e conteúdos apareçam automaticamente — **sem editar código nem
publicar uma nova versão do app**. Uma vez configurado, publicar conteúdo novo
é só fazer upload dos ficheiros na origem.

## Como funciona

```
Origem (Cloudflare)  →  Backend (proxy)  →  App
 categories.json         GET /catalog         Home descobre as categorias
 filmes.json              GET /catalog/filmes  Fileira "Mais conteúdos"
```

- O **backend** nunca guarda o conteúdo — só repassa (proxy) o que está na
  origem. Isso significa que atualizar o conteúdo é só mexer na origem; o
  backend não precisa de deploy novo.
- O **app** descobre as categorias sozinho a partir do manifesto (ver abaixo).
  Adicionar uma categoria nova é só publicar o ficheiro — nunca mexer em
  `frontend/config/cloudflare.ts` nem reiniciar o Expo.

## Passo 1 — Preparar os ficheiros

Numa pasta local, cria:

### a) O manifesto de categorias — `categories.json`

Lista todas as categorias que vais expor. O `key` de cada uma tem de bater
com o nome do ficheiro do passo seguinte.

```json
[
  { "key": "filmes-exclusivos", "label": "Exclusivos", "icon": "⚡" },
  { "key": "classicos-angola", "label": "Clássicos de Angola", "icon": "🎬" }
]
```

### b) Um ficheiro por categoria — ex: `filmes-exclusivos.json`

```json
[
  {
    "title": "Nome do Filme",
    "url": "https://meu-storage.com/video.mp4",
    "posterUrl": "https://meu-storage.com/poster.jpg",
    "synopsis": "Opcional — aparece no ecrã de preview.",
    "publishedAt": "2026-10-30"
  }
]
```

Campos:

| Campo         | Obrigatório | Descrição                                                                 |
|---------------|-------------|----------------------------------------------------------------------------|
| `title`       | sim         | Nome exibido no app.                                                      |
| `url`         | sim         | Link direto do vídeo (`.mp4`, `.m3u8`, etc.) **ou** outra lista JSON.      |
| `posterUrl`   | não         | Capa do item. Sem ela, mostra um ícone genérico.                          |
| `synopsis`    | não         | Texto mostrado no ecrã de preview antes de abrir o conteúdo.              |
| `publishedAt` | não         | Data ISO (`AAAA-MM-DD`). Dá destaque automático na Home — ver passo 4.    |

### Séries vs. conteúdo único (single)

- **Single (filme)**: `url` aponta direto para o ficheiro de vídeo.
- **Série**: `url` aponta para **outro** `.json`, no mesmo formato, um item
  por episódio. Pode ter mais de um nível (temporada → episódios) — o app
  resolve recursivamente, exatamente como as outras fontes já funcionam.

No fim tens, por exemplo:

```
lk-clip-catalogo/
  categories.json
  filmes-exclusivos.json
  classicos-angola.json
```

## Passo 2 — Publicar no Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Create** → aba **Pages** → **Upload assets**.
2. Dá um nome (ex: `lk-clip-catalogo`) e arrasta a pasta toda.
3. Resultado: um domínio tipo `https://lk-clip-catalogo.pages.dev`.
4. Confirma no browser que os ficheiros respondem:
   - `https://lk-clip-catalogo.pages.dev/categories.json`
   - `https://lk-clip-catalogo.pages.dev/filmes-exclusivos.json`

Não precisa ser literalmente "Cloudflare" — qualquer origem HTTP pública que
devolva estes JSONs funciona. Cloudflare Pages é só a opção mais simples
(grátis, sem escrever código).

Sempre que quiseres adicionar ou atualizar conteúdo: edita o `.json`
correspondente e faz upload de novo (ou `git push`, se ligares a um
repositório).

## Passo 3 — Configurar o backend

No `backend/.env`, preenche as duas variáveis (ver `.env.example`):

```env
LK_CLIP_CLOUDFLARE_CATEGORIES_URL=https://lk-clip-catalogo.pages.dev/categories.json
LK_CLIP_CLOUDFLARE_CATALOG_URL=https://lk-clip-catalogo.pages.dev/{category}.json
```

- A primeira é fixa — sempre o mesmo ficheiro do manifesto.
- A segunda usa `{category}`, substituído pelo `key` de cada categoria.

**Reinicia o backend** (`uvicorn`) — ele só lê o `.env` no arranque.

## Passo 4 — Destaque automático na Home (opcional)

Um item com `publishedAt` preenchido entra automaticamente no carrossel de
destaques da Home (com selo "🆕 NOVIDADE") durante **30 dias** a partir dessa
data. Depois disso, some do carrossel sozinho e continua a aparecer
normalmente na fileira da categoria.

Sem `publishedAt`, o item nunca entra em destaque — só na fileira normal.

## Passo 5 — Confirmar que está tudo ligado

Testa nesta ordem (fonte → backend → app):

```
https://lk-clip-catalogo.pages.dev/categories.json           → JSON do manifesto
http://<IP-do-PC>:8001/catalog                                → o mesmo JSON (via backend)
http://<IP-do-PC>:8001/catalog/filmes-exclusivos               → lista de filmes (via backend)
```

Se os três baterem, abre o app — a fileira "Mais conteúdos" aparece sozinha
na Home (respeita o cache de 6h; para ver na hora, usa "Limpar cache de
conteúdo" em Definições).

## Nunca precisas de

- Editar `frontend/config/cloudflare.ts`.
- Reiniciar o Expo.
- Publicar uma nova versão do app.

Tudo isso só é necessário se quiseres mudar o **código** do app — para
conteúdo, é sempre só upload na origem.

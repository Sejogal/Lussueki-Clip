import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

catalog_router = APIRouter(prefix="/catalog", tags=["Catálogo"])


def _relay(url: str) -> Response:
    request = Request(url, headers={"Accept": "application/json, application/vnd.apple.mpegurl, text/plain"})
    try:
        with urlopen(request, timeout=15) as upstream:
            body = upstream.read()
            content_type = upstream.headers.get_content_type()
            return Response(content=body, media_type=content_type)
    except HTTPError as error:
        raise HTTPException(status_code=error.code, detail="A origem Cloudflare recusou a consulta") from error
    except (URLError, TimeoutError) as error:
        raise HTTPException(status_code=502, detail="Não foi possível consultar a origem Cloudflare") from error


@catalog_router.get("")
def get_cloudflare_categories() -> Response:
    """Lista de categorias disponíveis na origem Cloudflare (manifesto).

    Configure LK_CLIP_CLOUDFLARE_CATEGORIES_URL com a URL de um JSON
    `[{"key", "label", "icon"}, ...]`. Isso é o que permite o app descobrir
    sozinho quais categorias existem — adicionar/remover uma categoria é só
    editar esse ficheiro e o `/{category}` correspondente, sem precisar
    tocar no código do app nem publicar uma nova versão dele.
    """
    index_url = os.getenv("LK_CLIP_CLOUDFLARE_CATEGORIES_URL", "").strip()
    if not index_url:
        raise HTTPException(status_code=503, detail="Lista de categorias Cloudflare não configurada")
    return _relay(index_url)


@catalog_router.get("/{category}")
def get_cloudflare_catalog(category: str) -> Response:
    """Obtém o catálogo da origem Cloudflare configurada no servidor.

    Configure LK_CLIP_CLOUDFLARE_CATALOG_URL como URL base ou como template
    contendo {category}. A origem pode responder JSON ou M3U.
    """
    base_url = os.getenv("LK_CLIP_CLOUDFLARE_CATALOG_URL", "").strip()
    if not base_url:
        raise HTTPException(status_code=503, detail="Catálogo Cloudflare não configurado")

    if "{category}" in base_url:
        url = base_url.replace("{category}", quote(category, safe=""))
    else:
        url = f"{base_url.rstrip('/')}/{quote(category, safe='')}"

    return _relay(url)

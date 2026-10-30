import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

catalog_router = APIRouter(prefix="/catalog", tags=["Catálogo"])


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

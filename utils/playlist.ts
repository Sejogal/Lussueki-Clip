// utils/playlist.ts
//
// Parsers compartilhados para os dois formatos de listagem usados pelo
// LK-CLIP:
//
// 1) Listagem de diretório do archive.org (HTML simples com <a href="...">)
// 2) Playlist EXTM3U em texto (paste.php?raw&id=XXX), onde cada item pode
//    ter um pôster embutido no próprio #EXTINF, no formato:
//      #EXTINF:-1="URL_DO_POSTER",Título do item
//      http://.../link-do-item
//
// O "link do item" pode ser mídia direta (.mp4/.mp3) OU outra playlist
// (ex: lista de episódios de uma série/anime) — quem decide isso é quem
// consome o PlaylistEntry (a Home só lista; o player resolve o próximo
// nível quando necessário).

export type PlaylistEntry = {
  title: string;
  url: string;
  posterUrl?: string;
};

const USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';

// Entradas promocionais que aparecem misturadas nas playlists reais
// (ex: "---WitFlixBr---" apontando pro loop de propaganda) — filtramos
// pra não aparecerem como conteúdo de verdade.
function isPromotionalEntry(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return /^-+\s*witflix/i.test(normalized) || normalized.includes('witflixloop');
}

/**
 * Extensões que indicam mídia reproduzível diretamente (sem precisar
 * resolver como playlist). Qualquer URL que não termine em uma dessas
 * é tratada como uma playlist a ser buscada e parseada.
 */
const DIRECT_MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.mp3', '.m3u8'];

export function isDirectMediaUrl(url: string): boolean {
  const clean = url.split('?')[0].toLowerCase();
  return DIRECT_MEDIA_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

/**
 * Faz o parsing de uma playlist EXTM3U (texto), extraindo título, pôster
 * (quando presente) e a URL de cada item.
 */
export function parseExtendedM3u(text: string, baseUrl: string): PlaylistEntry[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const entries: PlaylistEntry[] = [];

  let pendingTitle: string | null = null;
  let pendingPoster: string | undefined;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      // Formatos observados:
      //   #EXTINF:-1,Título
      //   #EXTINF:-1="URL_DO_POSTER",Título
      const afterColon = line.slice(line.indexOf(':') + 1);
      const commaIndex = afterColon.indexOf(',');
      const meta = commaIndex >= 0 ? afterColon.slice(0, commaIndex) : '';
      const title = commaIndex >= 0 ? afterColon.slice(commaIndex + 1).trim() : afterColon.trim();

      const posterMatch = meta.match(/"([^"]+)"/);
      pendingPoster = posterMatch ? posterMatch[1] : undefined;
      pendingTitle = title || null;
      continue;
    }

    if (line.startsWith('#')) continue;

    try {
      const resolvedUrl = new URL(line, baseUrl).toString();
      const fallbackName = decodeURIComponent(resolvedUrl.split('/').pop() || '');
      const title = pendingTitle || fallbackName || `Item ${entries.length + 1}`;

      if (!isPromotionalEntry(title)) {
        entries.push({ title, url: resolvedUrl, posterUrl: pendingPoster });
      }
    } catch {
      // Ignora linhas que não formam uma URL válida
    }

    pendingTitle = null;
    pendingPoster = undefined;
  }

  return entries;
}

/**
 * Faz o parsing de uma página de listagem de diretório do archive.org,
 * extraindo os arquivos .m3u disponíveis (cada um vira um "título").
 */
export function parseArchiveDirectoryListing(html: string, baseUrl: string): PlaylistEntry[] {
  const fileRegex = /href="([^"]+\.m3u)"/g;
  const entries: PlaylistEntry[] = [];

  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(html)) !== null) {
    const href = match[1];
    try {
      const resolvedUrl = new URL(href, baseUrl).toString();
      const rawName = decodeURIComponent(href.split('/').pop() || href);
      const title = rawName.replace(/\.[^/.]+$/, ''); // remove extensão
      entries.push({ title, url: resolvedUrl });
    } catch {
      // Ignora hrefs inválidos
    }
  }

  return entries;
}

/**
 * Busca uma URL e decide automaticamente qual parser aplicar:
 * - URLs terminadas em "/" são tratadas como diretório do archive.org
 * - Qualquer outra coisa é tratada como playlist EXTM3U em texto
 */
export async function fetchPlaylistEntries(url: string): Promise<PlaylistEntry[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }

  const text = await response.text();
  const isDirectoryListing = url.split('?')[0].endsWith('/');

  return isDirectoryListing ? parseArchiveDirectoryListing(text, url) : parseExtendedM3u(text, url);
}
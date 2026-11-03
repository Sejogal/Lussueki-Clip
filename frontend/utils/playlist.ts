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

import { filterFailedContent, readDeviceCache, writeDeviceCache } from '@/services/deviceCache';

export type PlaylistEntry = {
  title: string;
  url: string;
  posterUrl?: string;
  /** Só disponível quando a fonte realmente a fornece (hoje: busca do
   * archive.org e catálogo Cloudflare). As playlists EXTM3U (witflixbr)
   * não têm esse dado. */
  synopsis?: string;
  /** ISO 8601 — hoje só vem do catálogo Cloudflare. Usado pra decidir se
   * um item ainda está dentro da janela de destaque na Home (ver
   * HeroBanner.tsx). */
  publishedAt?: string;
};

const USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';
const UNROUTABLE_HOSTS = new Set(['0.0.0.0', '127.0.0.1', 'localhost', '[::1]']);

function isUsableHttpUrl(url: URL): boolean {
  return (url.protocol === 'http:' || url.protocol === 'https:') && !UNROUTABLE_HOSTS.has(url.hostname.toLowerCase());
}

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
 * Sinopses vindas de fontes externas (ex: descrição do archive.org) às
 * vezes vêm com marcação HTML simples (`<br>`, links). Tira as tags e
 * decodifica só as entidades mais comuns — o suficiente pra exibir como
 * texto corrido, sem puxar um parser de HTML inteiro pra isso.
 */
export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
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
      if (!isUsableHttpUrl(new URL(resolvedUrl))) {
        pendingTitle = null;
        pendingPoster = undefined;
        continue;
      }
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
 * Faz o parsing de uma playlist em JSON — formato usado pelo catálogo
 * Cloudflare (ver services/cloudflareCatalog.ts), tanto no nível de
 * categoria quanto dentro de um item (uma série pode apontar `url` pra
 * outra lista JSON de episódios, resolvida recursivamente como qualquer
 * outra playlist). Aceita algumas variações de nome de campo porque não
 * controlamos o formato exato do que for publicado na origem.
 */
export function parseJsonPlaylist(payload: unknown): PlaylistEntry[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? ['items', 'entries', 'data', 'results'].map((key) => (payload as Record<string, unknown>)[key]).find(Array.isArray)
      : null;
  if (!Array.isArray(list)) return [];

  const entries: PlaylistEntry[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const title = record.title ?? record.name;
    const url = record.url ?? record.link ?? record.source_url;
    const posterUrl = record.posterUrl ?? record.poster ?? record.image;
    const synopsis = record.synopsis ?? record.description ?? record.overview;
    const publishedAt = record.publishedAt ?? record.published_at ?? record.date;
    if (typeof title === 'string' && typeof url === 'string') {
      entries.push({
        title,
        url,
        posterUrl: typeof posterUrl === 'string' ? posterUrl : undefined,
        synopsis: typeof synopsis === 'string' ? stripHtml(synopsis) : undefined,
        publishedAt: typeof publishedAt === 'string' ? publishedAt : undefined,
      });
    }
  }
  return entries;
}

/**
 * Decide qual parser aplicar a uma resposta já buscada: JSON (array, ou
 * objeto com a lista dentro de items/entries/data/results), diretório do
 * archive.org (quando a URL termina em "/"), ou EXTM3U em texto — nessa
 * ordem. JSON é detectado pelo conteúdo, não pela URL, porque a mesma
 * origem (ex: Cloudflare) pode servir tanto o nível de categoria quanto
 * episódios individuais de uma série no mesmo formato.
 */
export function parsePlaylistResponse(text: string, url: string): PlaylistEntry[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return parseJsonPlaylist(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  const isDirectoryListing = url.split('?')[0].endsWith('/');
  return isDirectoryListing ? parseArchiveDirectoryListing(text, url) : parseExtendedM3u(text, url);
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
 * Busca uma URL e decide automaticamente qual parser aplicar — ver
 * parsePlaylistResponse. Usado tanto pela Home (listas de categoria)
 * quanto pelo player/preview, ao navegar pra dentro de um item que acaba
 * sendo outra playlist (ex: temporada → episódios).
 */
export async function fetchPlaylistEntries(url: string): Promise<PlaylistEntry[]> {
  const cached = await readDeviceCache<PlaylistEntry[]>(`playlist:${url}`);
  if (cached?.fresh) return filterFailedContent(cached.value);

  try {
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar ${url}`);

    const text = await response.text();
    const entries = parsePlaylistResponse(text, url);
    await writeDeviceCache(`playlist:${url}`, entries);
    return filterFailedContent(entries);
  } catch (error) {
    if (cached) return filterFailedContent(cached.value);
    throw error;
  }
}

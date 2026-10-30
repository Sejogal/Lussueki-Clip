// services/cloudflareCatalog.ts
//
// Catálogo adicional servido via proxy do backend (GET /catalog e
// GET /catalog/{category}, ver backend/routes/catalog.py), que por sua vez
// busca o conteúdo publicado numa origem Cloudflare (LK_CLIP_CLOUDFLARE_*
// no .env do backend). A origem pode responder tanto JSON quanto M3U — por
// isso detectamos o formato pelo corpo da resposta em vez de assumir um
// dos dois.
//
// As categorias são DESCOBERTAS, não hardcoded: GET /catalog devolve um
// manifesto (`[{key,label,icon}, ...]`) publicado junto com o conteúdo.
// Isso é o que permite "só fazer upload e aparece no app" — adicionar uma
// categoria nova é editar esse manifesto na origem, nunca o código do app.
//
// Mesmo tratamento das outras fontes (archive.org, paste.php): cache no
// dispositivo (evita bater no servidor toda hora) e filtro de conteúdo que
// já falhou antes (não reaparece na lista).
//
// Formato JSON preferido de cada item (ver parseJsonPlaylist em
// utils/playlist.ts):
//   [{
//     "title": "...", "url": "...", "posterUrl": "...",
//     "synopsis": "Opcional.",
//     "publishedAt": "2026-10-30"   // opcional, ISO 8601
//   }, ...]
// - "url" pode ser mídia direta (single) OU outra lista no mesmo formato
//   (série — cada "episódio" aponta pro próximo nível, resolvido conforme
//   o usuário navega, exatamente como as outras fontes).
// - "publishedAt" é o que dá destaque automático na Home (HeroBanner) nos
//   30 dias depois da publicação — sem ele, o item nunca aparece em
//   destaque, só na fileira normal da categoria.
import { getApiUrl } from '@/config/api';
import { filterFailedContent, readDeviceCache, writeDeviceCache } from '@/services/deviceCache';
import { parsePlaylistResponse, PlaylistEntry } from '@/utils/playlist';

export type CloudflareCategory = {
  /** Usado tanto como chave da fileira quanto no path /catalog/{key}. */
  key: string;
  label: string;
  icon: string;
};

function normalizeCategories(payload: unknown): CloudflareCategory[] {
  if (!Array.isArray(payload)) return [];
  const categories: CloudflareCategory[] = [];
  for (const raw of payload) {
    if (!raw || typeof raw !== 'object') continue;
    const record = raw as Record<string, unknown>;
    const key = record.key ?? record.id;
    const label = record.label ?? record.name ?? key;
    const icon = record.icon;
    if (typeof key === 'string' && typeof label === 'string') {
      categories.push({ key, label, icon: typeof icon === 'string' && icon ? icon : '📁' });
    }
  }
  return categories;
}

// Cópia em memória da última lista conhecida — permite que
// getCategoryDisplay() (síncrono, usado no preview/busca pra achar o
// ícone/label de uma categoria a partir só da chave) resolva categorias
// Cloudflare sem precisar virar função assíncrona. Mesma ideia do cache em
// memória de services/iptv.ts.
let categoriesSnapshot: CloudflareCategory[] = [];

export function getCachedCloudflareCategories(): CloudflareCategory[] {
  return categoriesSnapshot;
}

/**
 * Busca o manifesto de categorias (GET /catalog). Falha em silêncio (devolve
 * []) quando não há nada configurado ainda — esse é o estado normal antes
 * de qualquer conteúdo ser publicado, não um erro pro usuário ver.
 */
export async function fetchCloudflareCategories(): Promise<CloudflareCategory[]> {
  const cacheKey = 'cloudflare-categories';
  const cached = await readDeviceCache<CloudflareCategory[]>(cacheKey);
  if (cached) categoriesSnapshot = cached.value;
  if (cached?.fresh) return cached.value;

  const url = `${getApiUrl()}/catalog`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar categorias Cloudflare`);
    const categories = normalizeCategories(await response.json());
    await writeDeviceCache(cacheKey, categories);
    categoriesSnapshot = categories;
    return categories;
  } catch {
    return cached?.value ?? [];
  }
}

/**
 * Catálogo de uma categoria. O parsing (JSON — incluindo `publishedAt` —
 * ou M3U) é o mesmo `parsePlaylistResponse` usado por qualquer playlist no
 * app, então um item aqui pode ser tanto mídia direta (single) quanto
 * apontar pra OUTRA lista JSON de episódios (série) — resolvido
 * recursivamente pelo preview/player como qualquer outra fonte.
 */
export async function fetchCloudflareCatalog(category: string): Promise<PlaylistEntry[]> {
  const cacheKey = `cloudflare-catalog:${category}`;
  const cached = await readDeviceCache<PlaylistEntry[]>(cacheKey);
  if (cached?.fresh) return filterFailedContent(cached.value);

  const url = `${getApiUrl()}/catalog/${encodeURIComponent(category)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar o catálogo Cloudflare (${category})`);

    const text = await response.text();
    const entries = parsePlaylistResponse(text, url);
    await writeDeviceCache(cacheKey, entries);
    return filterFailedContent(entries);
  } catch (error) {
    if (cached) return filterFailedContent(cached.value);
    throw error;
  }
}

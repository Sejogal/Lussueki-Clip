// services/api.ts
import { CATEGORIES, CategoryKey } from '../config/index';
import { fetchPlaylistEntries, PlaylistEntry } from '../utils/playlist';

/**
 * Busca o conteúdo de uma categoria (ex: 'series', 'animes'...).
 * Tenta a fonte primária (link2 quando existir — geralmente mais rica,
 * com pôster — senão link1); se falhar ou vier vazia, tenta a outra
 * fonte como fallback.
 */
export async function fetchCategoryContent(category: CategoryKey): Promise<PlaylistEntry[]> {
  const config = CATEGORIES[category];
  if (!config) {
    console.error('❌ Categoria desconhecida:', category);
    return [];
  }

  const primaryUrl = config.link2 || config.link1;
  const fallbackUrl = primaryUrl === config.link1 ? config.link2 : config.link1;

  if (!primaryUrl) {
    console.error('❌ Nenhuma fonte configurada para a categoria:', category);
    return [];
  }

  try {
    console.log(`📡 [${category}] Buscando conteúdo de:`, primaryUrl);
    const entries = await fetchPlaylistEntries(primaryUrl);
    if (entries.length > 0) {
      console.log(`✅ [${category}] ${entries.length} item(ns) encontrados`);
      return entries;
    }
    console.warn(`⚠️ [${category}] Fonte primária retornou vazia, tentando fallback...`);
  } catch (err) {
    console.error(`❌ [${category}] Erro na fonte primária:`, err);
  }

  if (fallbackUrl) {
    try {
      console.log(`📡 [${category}] Tentando fonte alternativa:`, fallbackUrl);
      const entries = await fetchPlaylistEntries(fallbackUrl);
      console.log(`✅ [${category}] ${entries.length} item(ns) encontrados (fallback)`);
      return entries;
    } catch (err) {
      console.error(`❌ [${category}] Erro na fonte alternativa:`, err);
    }
  }

  return [];
}

// Mantido por compatibilidade com código antigo que importava
// fetchContents() diretamente para a Home antiga (só séries).
export async function fetchContents(): Promise<string[]> {
  const entries = await fetchCategoryContent('series');
  return entries.map((entry) => entry.title);
}

export type { PlaylistEntry };
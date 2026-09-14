// services/favorites.ts
import { FavoriteResponse, addFavorite, removeFavorite } from '@/services/auth';

export type FavoriteItem = {
  title: string;
  /** URL original de nível 1 (o que foi tocado a partir da Home) — usada
   * como identificador único, já que é estável mesmo quando o conteúdo
   * tem vários níveis de playlist por baixo. */
  url: string;
  posterUrl?: string;
  /** Chave da categoria de origem — pode ser uma das categorias
   * "legado" (CategoryKey) ou uma categoria de domínio público
   * (archive.org), por isso é string livre em vez do union restrito. */
  categoryKey?: string;
  contentKey?: string;
  addedAt: number;
};

export function toFavoriteItem(item: FavoriteResponse): FavoriteItem {
  return {
    title: item.title,
    url: item.source_url,
    posterUrl: item.poster_url ?? undefined,
    categoryKey: item.category ?? undefined,
    contentKey: item.content_key,
    addedAt: Date.parse(item.added_at),
  };
}

export function favoritePayload(item: Omit<FavoriteItem, 'addedAt'>): Record<string, string | undefined> {
  return {
    content_key: item.contentKey,
    title: item.title,
    category: item.categoryKey,
    source_url: item.url,
    poster_url: item.posterUrl,
  };
}

export { addFavorite, removeFavorite };
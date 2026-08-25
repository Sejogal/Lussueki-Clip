// services/favorites.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  addedAt: number;
};

const STORAGE_KEY = 'lk-clip:favorites';

export async function loadFavorites(): Promise<FavoriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('❌ Erro ao carregar favoritos:', err);
    return [];
  }
}

export async function saveFavorites(favorites: FavoriteItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (err) {
    console.error('❌ Erro ao salvar favoritos:', err);
  }
}
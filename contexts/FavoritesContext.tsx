// contexts/FavoritesContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FavoriteItem, loadFavorites, saveFavorites } from '@/services/favorites';

export type { FavoriteItem };

type FavoritesContextValue = {
  favorites: FavoriteItem[];
  loading: boolean;
  isFavorite: (url: string) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega os favoritos salvos assim que o app abre.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadFavorites();
      if (!cancelled) {
        setFavorites(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFavorite = useCallback(
    (url: string) => favorites.some((fav) => fav.url === url),
    [favorites]
  );

  const toggleFavorite = useCallback((item: Omit<FavoriteItem, 'addedAt'>) => {
    setFavorites((current) => {
      const exists = current.some((fav) => fav.url === item.url);
      const next = exists
        ? current.filter((fav) => fav.url !== item.url)
        : [{ ...item, addedAt: Date.now() }, ...current];

      // Persiste em segundo plano — a UI já reflete o novo estado
      // imediatamente, sem esperar o AsyncStorage terminar de escrever.
      saveFavorites(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ favorites, loading, isFavorite, toggleFavorite }),
    [favorites, loading, isFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites precisa ser usado dentro de <FavoritesProvider>');
  }
  return ctx;
}
// contexts/FavoritesContext.tsx
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFavorites } from '@/services/auth';
import { addFavorite, FavoriteItem, favoritePayload, removeFavorite, toFavoriteItem } from '@/services/favorites';

export type { FavoriteItem };

type FavoritesContextValue = {
  favorites: FavoriteItem[];
  loading: boolean;
  isFavorite: (url: string) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, 'addedAt'>) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) {
        setFavorites([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const stored = (await getFavorites(session.accessToken)).map(toFavoriteItem);
        if (!cancelled) setFavorites(stored);
      } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
        if (!cancelled) setFavorites([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const isFavorite = useCallback(
    (url: string) => favorites.some((fav) => fav.url === url),
    [favorites]
  );

  const toggleFavorite = useCallback(async (item: Omit<FavoriteItem, 'addedAt'>) => {
    if (!session) {
      router.push('/auth');
      return;
    }
    const exists = favorites.find((favorite) => favorite.url === item.url);
    if (exists) {
      if (!exists.contentKey) return;
      await removeFavorite(session.accessToken, exists.contentKey);
      setFavorites((current) => current.filter((favorite) => favorite.url !== item.url));
      return;
    }
    const saved = await addFavorite(session.accessToken, favoritePayload(item));
    setFavorites((current) => [toFavoriteItem(saved), ...current.filter((favorite) => favorite.url !== item.url)]);
  }, [favorites, router, session]);

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
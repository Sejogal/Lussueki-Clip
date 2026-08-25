// components/FavoriteButton.tsx
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { FavoriteItem, useFavorites } from '@/contexts/FavoritesContext';

type Props = {
  item: Omit<FavoriteItem, 'addedAt'>;
  /**
   * 'overlay': círculo pequeno no canto do pôster (Home, hero, minha lista)
   * 'floating': botão retangular flutuante, estilo dos botões do player
   */
  variant?: 'overlay' | 'floating';
  size?: number;
};

export default function FavoriteButton({ item, variant = 'overlay', size }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(item.url);
  const iconSize = size ?? (variant === 'overlay' ? 16 : 18);

  return (
    <TouchableOpacity
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={variant === 'overlay' ? styles.overlay : styles.floating}
      onPress={(e) => {
        e.stopPropagation?.();
        toggleFavorite(item);
      }}
    >
      <Ionicons
        name={active ? 'heart' : 'heart-outline'}
        size={iconSize}
        color={active ? '#e50914' : '#fff'}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    padding: 5,
    zIndex: 5,
  },
  floating: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    paddingHorizontal: 13,
    borderRadius: 8,
  },
});
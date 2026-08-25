// components/FavoritesRow.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { FavoriteItem, useFavorites } from '@/contexts/FavoritesContext';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 170;

// Item memoizado — mesma lógica de performance da CategoryRow: evita que
// o FlatList recrie/re-renderize cada cartão sem necessidade.
type FavoriteCardProps = {
  item: FavoriteItem;
  onPress: (item: FavoriteItem) => void;
};

const FavoriteCard = React.memo(function FavoriteCard({ item, onPress }: FavoriteCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.75} style={styles.posterCard} onPress={() => onPress(item)}>
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={{ fontSize: 28 }}>🎬</Text>
          </View>
        )}
        <FavoriteButton item={item} variant="overlay" />
      </View>
      <Text style={styles.posterTitle} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

export default function FavoritesRow() {
  const router = useRouter();
  const { favorites } = useFavorites();

  const handlePress = useCallback(
    (item: FavoriteItem) => {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: item.url,
          title: item.title,
          posterUrl: item.posterUrl ?? '',
          categoryKey: item.categoryKey ?? '',
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: FavoriteItem }) => <FavoriteCard item={item} onPress={handlePress} />,
    [handlePress]
  );

  const keyExtractor = useCallback((item: FavoriteItem) => item.url, []);

  // Sem favoritos ainda: não mostra a fileira (mesma lógica de "some
  // silenciosamente" usada pelas CategoryRow vazias).
  if (favorites.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>❤️</Text>
        <Text style={styles.title}>Minha Lista</Text>
      </View>

      <FlatList
        data={favorites}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: POSTER_WIDTH + 12,
          offset: (POSTER_WIDTH + 12) * index,
          index,
        })}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  posterCard: {
    width: POSTER_WIDTH,
    marginRight: 12,
  },
  posterWrapper: {
    position: 'relative',
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
  },
  posterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterTitle: {
    color: '#d1d1d6',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 15,
  },
});
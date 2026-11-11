// components/CategoryRow.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { CategoryConfig, CategoryKey } from '@/config/index';
import { fetchCategoryContent } from '@/services/api';
import { PlaylistEntry } from '@/utils/playlist';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';

type Props = {
  categoryKey: CategoryKey;
  config: CategoryConfig;
};

const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 170;

// ── Item do pôster, extraído como componente memoizado ───────────────
// Sem isso, o FlatList recria o JSX de CADA pôster toda vez que a
// CategoryRow re-renderiza (mesmo sem os dados terem mudado), o que é
// exatamente o que dispara o aviso "large list that is slow to update"
// do VirtualizedList. Com React.memo, um pôster só re-renderiza se as
// próprias props dele mudarem.
type PosterItemProps = {
  item: PlaylistEntry;
  categoryKey: CategoryKey;
  icon: string;
  onPress: (item: PlaylistEntry) => void;
  posterWidth: number;
  posterHeight: number;
  largeScreen: boolean;
};

const PosterItem = React.memo(function PosterItem({ item, categoryKey, icon, onPress, posterWidth, posterHeight, largeScreen }: PosterItemProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableOpacity focusable activeOpacity={0.75} style={[styles.posterCard, { width: posterWidth }, focused && styles.posterCardFocused]} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={() => onPress(item)}>
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={[styles.poster, { width: posterWidth, height: posterHeight }]} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, { width: posterWidth, height: posterHeight }, styles.posterFallback]}>
            <Text style={styles.posterFallbackIcon}>{icon}</Text>
          </View>
        )}
        <FavoriteButton
          item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey }}
          variant="overlay"
        />
      </View>
      <Text style={[styles.posterTitle, largeScreen && styles.posterTitleLarge]} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

function CategoryRow({ categoryKey, config }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const largeScreen = width >= 900;
  const posterWidth = largeScreen ? 174 : POSTER_WIDTH;
  const posterHeight = Math.round(posterWidth * 1.42);
  const [items, setItems] = useState<PlaylistEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const entries = await fetchCategoryContent(categoryKey);
        if (cancelled) return;
        setItems(entries);
      } catch (err) {
        console.error(`❌ Erro ao carregar categoria ${categoryKey}:`, err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryKey]));

  // useCallback: a função só é recriada se categoryKey/router mudarem,
  // então PosterItem (memoizado) não re-renderiza por causa dela.
  const handlePress = useCallback(
    (item: PlaylistEntry) => {
      router.push({
        pathname: '/preview',
        params: {
          streamUrl: item.url,
          title: item.title,
          posterUrl: item.posterUrl ?? '',
          categoryKey,
        },
      });
    },
    [router, categoryKey]
  );

  const renderItem = useCallback(
    ({ item }: { item: PlaylistEntry }) => (
      <PosterItem item={item} categoryKey={categoryKey} icon={config.icon} onPress={handlePress} posterWidth={posterWidth} posterHeight={posterHeight} largeScreen={largeScreen} />
    ),
    [categoryKey, config.icon, handlePress, posterWidth, posterHeight, largeScreen]
  );

  const keyExtractor = useCallback(
    (item: PlaylistEntry, index: number) => `${categoryKey}-${index}-${item.url}`,
    [categoryKey]
  );

  // Categoria sem conteúdo (ou com erro): não polui a Home com uma
  // fileira vazia — simplesmente não renderiza nada.
  if (!loading && (error || !items || items.length === 0)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, largeScreen && styles.headerLarge]}>
        <Text style={styles.icon}>{config.icon}</Text>
        <Text style={[styles.title, largeScreen && styles.titleLarge]}>{config.label}</Text>
        <TouchableOpacity
          focusable
          accessibilityRole="button"
          style={[styles.seeMoreButton, largeScreen && styles.seeMoreButtonLarge]}
          onPress={() => router.push({ pathname: '/category/[category]', params: { category: categoryKey } })}
        >
          <Text style={[styles.seeMoreText, largeScreen && styles.seeMoreTextLarge]}>Ver mais</Text>
          <Text style={styles.seeMoreChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[styles.loadingRow, { height: posterHeight }]}>
          <ActivityIndicator size="small" color="#e50914" />
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          // Ajuda o VirtualizedList a calcular posições sem medir cada
          // item na tela (todos têm largura/altura fixas aqui).
          getItemLayout={(_, index) => ({
            length: posterWidth + 12,
            offset: (posterWidth + 12) * index,
            index,
          })}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={!largeScreen}
        />
      )}
    </View>
  );
}

export default React.memo(CategoryRow);

const styles = StyleSheet.create({
  container: {
    marginBottom: 22,
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  headerLarge: { paddingHorizontal: 28, marginBottom: 14 },
  titleLarge: { fontSize: 21 },
  seeMoreButtonLarge: { minHeight: 44, paddingHorizontal: 14 },
  seeMoreTextLarge: { fontSize: 16 },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  seeMoreText: {
    color: '#ff777d',
    fontSize: 12,
    fontWeight: '700',
  },
  seeMoreChevron: {
    color: '#ff777d',
    fontSize: 20,
    lineHeight: 20,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  loadingRow: {
    height: POSTER_HEIGHT,
    justifyContent: 'center',
    paddingLeft: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  posterCard: {
    width: POSTER_WIDTH,
    marginRight: 12,
  },
  posterCardFocused: { backgroundColor: '#27272b', borderColor: '#fff', borderWidth: 2, borderRadius: 10, transform: [{ scale: 1.05 }], zIndex: 2 },
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
  posterFallbackIcon: {
    fontSize: 32,
  },
  posterTitleLarge: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  posterTitle: {
    color: '#d1d1d6',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 15,
  },
});

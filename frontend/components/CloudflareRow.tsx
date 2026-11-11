// components/CloudflareRow.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { CloudflareCategory } from '@/config/cloudflare';
import { fetchCloudflareCatalog } from '@/services/cloudflareCatalog';
import { PlaylistEntry } from '@/utils/playlist';
import { useFocusEffect, useRouter } from 'expo-router';
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
  category: CloudflareCategory;
};

const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 170;

type PosterItemProps = {
  item: PlaylistEntry;
  categoryKey: string;
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

function CloudflareRow({ category }: Props) {
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
        const entries = await fetchCloudflareCatalog(category.key);
        if (cancelled) return;
        setItems(entries);
      } catch (err) {
        console.error(`❌ Erro ao carregar catálogo Cloudflare ${category.key}:`, err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category.key]));

  const handlePress = useCallback(
    (item: PlaylistEntry) => {
      router.push({
        pathname: '/preview',
        params: {
          streamUrl: item.url,
          title: item.title,
          posterUrl: item.posterUrl ?? '',
          categoryKey: category.key,
          synopsis: item.synopsis ?? '',
        },
      });
    },
    [router, category.key]
  );

  const renderItem = useCallback(
    ({ item }: { item: PlaylistEntry }) => (
      <PosterItem item={item} categoryKey={category.key} icon={category.icon} onPress={handlePress} posterWidth={posterWidth} posterHeight={posterHeight} largeScreen={largeScreen} />
    ),
    [category.key, category.icon, handlePress, posterWidth, posterHeight, largeScreen]
  );

  const keyExtractor = useCallback(
    (item: PlaylistEntry, index: number) => `${category.key}-${index}-${item.url}`,
    [category.key]
  );

  // Mesmo comportamento das outras fileiras: categoria sem conteúdo (ou com
  // erro) simplesmente não aparece, em vez de mostrar uma fileira quebrada.
  if (!loading && (error || !items || items.length === 0)) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{category.icon}</Text>
        <Text style={styles.title}>{category.label}</Text>
      </View>

      {loading ? (
        <View style={[styles.loadingRow, { height: posterHeight } ]}>
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

export default React.memo(CloudflareRow);

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10, gap: 8 },
  icon: { fontSize: 16 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  loadingRow: { height: POSTER_HEIGHT, justifyContent: 'center', paddingLeft: 16 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  posterCard: { width: POSTER_WIDTH, marginRight: 12 },
  posterCardFocused: { backgroundColor: '#27272b', borderColor: '#fff', borderWidth: 2, borderRadius: 10, transform: [{ scale: 1.05 }], zIndex: 2 },
  posterWrapper: { position: 'relative' },
  poster: { width: POSTER_WIDTH, height: POSTER_HEIGHT, borderRadius: 8, backgroundColor: '#1c1c1e' },
  posterFallback: { justifyContent: 'center', alignItems: 'center' },
  posterFallbackIcon: { fontSize: 32 },
  posterTitle: { color: '#d1d1d6', fontSize: 12, marginTop: 6, lineHeight: 15 },
  posterTitleLarge: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
});

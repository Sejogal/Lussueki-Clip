// components/PublicDomainRow.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { PublicDomainCategory, searchArchiveOrg } from '@/services/archiveOrg';
import { PlaylistEntry } from '@/utils/playlist';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type Props = {
  category: PublicDomainCategory;
};

const POSTER_WIDTH = 120;
const POSTER_HEIGHT = 170;

// Mesmo componente de item memoizado usado na CategoryRow — evita
// re-renderizações desnecessárias na lista (ver o aviso do
// VirtualizedList que já resolvemos antes).
type PosterItemProps = {
  item: PlaylistEntry;
  categoryKey: string;
  icon: string;
  onPress: (item: PlaylistEntry) => void;
};

const PosterItem = React.memo(function PosterItem({ item, categoryKey, icon, onPress }: PosterItemProps) {
  return (
    <TouchableOpacity activeOpacity={0.75} style={styles.posterCard} onPress={() => onPress(item)}>
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={styles.posterFallbackIcon}>{icon}</Text>
          </View>
        )}
        <FavoriteButton
          item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey }}
          variant="overlay"
        />
      </View>
      <Text style={styles.posterTitle} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

function PublicDomainRow({ category }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PlaylistEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const entries = await searchArchiveOrg(category.query);
        if (cancelled) return;
        setItems(entries);
      } catch (err) {
        console.error(`❌ Erro ao carregar categoria de domínio público ${category.key}:`, err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category.key, category.query]);

  const handlePress = useCallback(
    (item: PlaylistEntry) => {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: item.url,
          title: item.title,
          posterUrl: item.posterUrl ?? '',
          categoryKey: category.key,
        },
      });
    },
    [router, category.key]
  );

  const renderItem = useCallback(
    ({ item }: { item: PlaylistEntry }) => (
      <PosterItem item={item} categoryKey={category.key} icon={category.icon} onPress={handlePress} />
    ),
    [category.key, category.icon, handlePress]
  );

  const keyExtractor = useCallback(
    (item: PlaylistEntry, index: number) => `${category.key}-${index}-${item.url}`,
    [category.key]
  );

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
        <View style={styles.loadingRow}>
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
            length: POSTER_WIDTH + 12,
            offset: (POSTER_WIDTH + 12) * index,
            index,
          })}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
        />
      )}
    </View>
  );
}

export default React.memo(PublicDomainRow);

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
  posterTitle: {
    color: '#d1d1d6',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 15,
  },
});
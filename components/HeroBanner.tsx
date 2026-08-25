// components/HeroBanner.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { CategoryKey } from '@/config/index';
import { fetchCategoryContent } from '@/services/api';
import { getCategoryDisplay } from '@/utils/categoryDisplay';
import { PlaylistEntry } from '@/utils/playlist';
import { getHiResImage } from '@/utils/tmdb';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 1.25);
const AUTO_ADVANCE_MS = 6000;

type FeaturedItem = PlaylistEntry & { categoryKey: CategoryKey };

// Categorias com maior chance de ter pôster do TMDB (via paste.php), em
// ordem de preferência — uma vira (no máximo) um slide do carrossel.
const FEATURED_CATEGORY_PRIORITY: CategoryKey[] = [
  'series',
  'filmes',
  'animes',
  'doramas',
  'novelas',
  'desenhos',
];

// ── Slide, extraído como componente memoizado ─────────────────────────
// activeIndex muda a cada swipe/auto-advance (para as bolinhas). Sem
// memoizar o slide, TODO slide re-renderiza a cada troca de página —
// mesmo que só as bolinhas tenham mudado. React.memo evita isso.
type SlideProps = {
  item: FeaturedItem;
  onPress: (item: FeaturedItem) => void;
};

const Slide = React.memo(function Slide({ item, onPress }: SlideProps) {
  const categoryDisplay = getCategoryDisplay(item.categoryKey);
  return (
    <TouchableOpacity activeOpacity={0.94} style={styles.slide} onPress={() => onPress(item)}>
      <Image source={{ uri: getHiResImage(item.posterUrl, 'w780') }} style={styles.image} resizeMode="cover" />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', '#000']}
        locations={[0, 0.55, 1]}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {categoryDisplay.icon} EM DESTAQUE · {categoryDisplay.label.toUpperCase()}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        <TouchableOpacity style={styles.playButton} onPress={() => onPress(item)}>
          <Text style={styles.playButtonText}>▶  Assistir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.heroFavorite}>
        <FavoriteButton
          item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey: item.categoryKey }}
          variant="floating"
          size={20}
        />
      </View>
    </TouchableOpacity>
  );
});

export default function HeroBanner() {
  const router = useRouter();
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const flatListRef = useRef<FlatList<FeaturedItem>>(null);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Busca um destaque de cada categoria em paralelo — cada uma que
      // tiver pôster disponível vira um slide do carrossel.
      const results = await Promise.all(
        FEATURED_CATEGORY_PRIORITY.map(async (categoryKey): Promise<FeaturedItem | null> => {
          try {
            const entries = await fetchCategoryContent(categoryKey);
            const withPoster = entries.filter((entry) => entry.posterUrl);
            if (withPoster.length === 0) return null;
            const pick = withPoster[Math.floor(Math.random() * withPoster.length)];
            return { ...pick, categoryKey };
          } catch (err) {
            console.error(`❌ [hero] Erro ao buscar ${categoryKey}:`, err);
            return null;
          }
        })
      );

      if (cancelled) return;
      setItems(results.filter((item): item is FeaturedItem => item !== null));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Avança sozinho a cada alguns segundos, dando a volta no fim. Recria o
  // timer só quando a quantidade de slides muda (não a cada troca de
  // slide) para não ficar resetando a contagem toda hora.
  useEffect(() => {
    if (items.length <= 1) return;

    const interval = setInterval(() => {
      const nextIndex = (activeIndexRef.current + 1) % items.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(interval);
  }, [items.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const index = viewableItems[0].index ?? 0;
      activeIndexRef.current = index;
      setActiveIndex(index);
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const keyExtractor = useCallback((item: FeaturedItem) => `${item.categoryKey}-${item.url}`, []);

  const goToPlayer = useCallback(
    (item: FeaturedItem) => {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: item.url,
          title: item.title,
          posterUrl: item.posterUrl ?? '',
          categoryKey: item.categoryKey,
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: FeaturedItem }) => <Slide item={item} onPress={goToPlayer} />,
    [goToPlayer]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator color="#e50914" />
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={renderItem}
      />

      {items.length > 1 && (
        <View style={styles.dotsRow}>
          {items.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
  },
  heroFavorite: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  playButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  playButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
});
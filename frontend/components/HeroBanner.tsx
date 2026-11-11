// components/HeroBanner.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { CATEGORIES, CategoryKey } from '@/config/index';
import { fetchCategoryContent } from '@/services/api';
import { fetchCloudflareCatalog, fetchCloudflareCategories } from '@/services/cloudflareCatalog';
import { getCategoryDisplay } from '@/utils/categoryDisplay';
import { PlaylistEntry } from '@/utils/playlist';
import { getHiResImage } from '@/utils/tmdb';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
    useWindowDimensions,
} from 'react-native';

const AUTO_ADVANCE_MS = 6000;

// categoryKey é string (não só CategoryKey) pra caber também categorias
// Cloudflare, que são descobertas em tempo de execução.
type FeaturedItem = PlaylistEntry & { categoryKey: string; isNew?: boolean; fallbackPosterUrl?: string };

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

// Conteúdo Cloudflare com `publishedAt` fica em destaque na Home por esse
// tempo depois de publicado; passado isso, volta a aparecer só na fileira
// normal da categoria (ver services/cloudflareCatalog.ts).
const FEATURED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
// Limite de segurança — evita o carrossel ficar gigante se alguém
// publicar dezenas de itens com data recente de uma vez.
const MAX_CLOUDFLARE_FEATURED = 8;

function normalizePosterUrl(url?: string): string | undefined {
  const value = url?.trim().replace(/&amp;/g, '&');
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/t/p/')) return `https://image.tmdb.org${value}`;
  if (value.startsWith('t/p/')) return `https://image.tmdb.org/${value}`;
  if (value.startsWith('www.')) return `https://${value}`;
  if (/^http:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
  if (/^(image\.tmdb\.org|www\.themoviedb\.org)\//i.test(value)) return `https://${value}`;
  return value;
}

// ── Slide, extraído como componente memoizado ─────────────────────────
// activeIndex muda a cada swipe/auto-advance (para as bolinhas). Sem
// memoizar o slide, TODO slide re-renderiza a cada troca de página —
// mesmo que só as bolinhas tenham mudado. React.memo evita isso.
type SlideProps = {
  item: FeaturedItem;
  width: number;
  height: number;
  onOpenPreview: (item: FeaturedItem) => void;
  onPlay: (item: FeaturedItem) => void;
};

const Slide = React.memo(function Slide({ item, width, height, onOpenPreview, onPlay }: SlideProps) {
  const categoryDisplay = getCategoryDisplay(item.categoryKey);
  const originalPosterUrl = item.posterUrl?.trim().replace(/&amp;/g, '&');
  const normalizedPosterUrl = normalizePosterUrl(item.posterUrl);
  const normalizedFallbackUrl = normalizePosterUrl(item.fallbackPosterUrl);
  const [imageUri, setImageUri] = useState(normalizedPosterUrl ?? normalizedFallbackUrl);
  const [originalAttempted, setOriginalAttempted] = useState(false);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const [alternateAttempted, setAlternateAttempted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const alternateImageUri = getHiResImage(normalizedPosterUrl, 'w500');
  const handleImageError = useCallback(() => {
    if (!originalAttempted && originalPosterUrl && originalPosterUrl !== imageUri) {
      setOriginalAttempted(true);
      setImageUri(originalPosterUrl);
      return;
    }
    if (!alternateAttempted && alternateImageUri && alternateImageUri !== imageUri) {
      setAlternateAttempted(true);
      setImageUri(alternateImageUri);
      return;
    }
    if (!fallbackAttempted && normalizedFallbackUrl && normalizedFallbackUrl !== imageUri) {
      setFallbackAttempted(true);
      setImageUri(normalizedFallbackUrl);
      return;
    }
    setImageFailed(true);
  }, [alternateAttempted, alternateImageUri, fallbackAttempted, imageUri, normalizedFallbackUrl, originalAttempted, originalPosterUrl]);
  return (
    <TouchableOpacity focusable activeOpacity={0.94} style={[styles.slide, { width, height }]} onPress={() => onOpenPreview(item)}>
      {imageUri && !imageFailed ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" onError={handleImageError} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Text style={styles.imageFallbackIcon}>{categoryDisplay.icon}</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', '#000']}
        locations={[0, 0.55, 1]}
        style={styles.gradient}
      />

      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.isNew
              ? `🆕 NOVIDADE · ${categoryDisplay.label.toUpperCase()}`
              : `${categoryDisplay.icon} EM DESTAQUE · ${categoryDisplay.label.toUpperCase()}`}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        <TouchableOpacity focusable style={styles.playButton} onPress={() => onPlay(item)}>
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const SCREEN_WIDTH = Math.min(windowWidth, 1280);
  const HERO_HEIGHT = Math.min(windowHeight * 0.72, Math.max(320, SCREEN_WIDTH * (windowWidth > windowHeight ? 0.58 : 1.05)));
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
      const curatedResults = await Promise.all(
        FEATURED_CATEGORY_PRIORITY.map(async (categoryKey): Promise<FeaturedItem | null> => {
          try {
            const entries = await fetchCategoryContent(categoryKey);
            const withPoster = entries.filter((entry) => entry.posterUrl);
            if (withPoster.length === 0) return null;
            const pick = withPoster[Math.floor(Math.random() * withPoster.length)];
            return { ...pick, categoryKey, fallbackPosterUrl: CATEGORIES[categoryKey]?.capa };
          } catch (err) {
            console.error(`❌ [hero] Erro ao buscar ${categoryKey}:`, err);
            return null;
          }
        })
      );
      const curated = curatedResults.filter((item): item is FeaturedItem => item !== null);

      // Conteúdo Cloudflare publicado há menos de 30 dias entra em
      // destaque automaticamente — sem isso, cada novo upload ficaria
      // "escondido" na fileira normal até alguém abrir a categoria.
      let cloudflareFeatured: FeaturedItem[] = [];
      try {
        const categories = await fetchCloudflareCategories();
        const now = Date.now();
        const perCategory = await Promise.all(
          categories.map(async (category): Promise<FeaturedItem[]> => {
            try {
              const entries = await fetchCloudflareCatalog(category.key);
              return entries
                .filter((entry) => {
                  if (!entry.posterUrl || !entry.publishedAt) return false;
                  const publishedTime = new Date(entry.publishedAt).getTime();
                  return Number.isFinite(publishedTime) && now - publishedTime < FEATURED_WINDOW_MS;
                })
                .map((entry) => ({ ...entry, categoryKey: category.key, isNew: true }));
            } catch {
              return [];
            }
          })
        );
        cloudflareFeatured = perCategory
          .flat()
          .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
          .slice(0, MAX_CLOUDFLARE_FEATURED);
      } catch {
        cloudflareFeatured = [];
      }

      if (cancelled) return;
      // Novidades primeiro — é o conteúdo mais efêmero, faz sentido liderar
      // o carrossel enquanto durar a janela de destaque.
      setItems([...cloudflareFeatured, ...curated]);
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
    [SCREEN_WIDTH]
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

  const openPreview = useCallback(
    (item: FeaturedItem) => {
      router.push({
        pathname: '/preview',
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
    ({ item }: { item: FeaturedItem }) => <Slide item={item} width={SCREEN_WIDTH} height={HERO_HEIGHT} onOpenPreview={openPreview} onPlay={goToPlayer} />,
    [openPreview, goToPlayer, SCREEN_WIDTH, HERO_HEIGHT]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { width: SCREEN_WIDTH, height: HERO_HEIGHT, alignSelf: 'center' }]}>
        <ActivityIndicator color="#e50914" />
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height: HERO_HEIGHT, alignSelf: 'center' }]}>
      <FlatList
        ref={flatListRef}
        style={styles.slideList}
        data={items}
        horizontal
        nestedScrollEnabled
        removeClippedSubviews={false}
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
  slide: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
  container: {
    backgroundColor: '#0a0a0a',
  },
  slideList: { flex: 1 },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    backgroundColor: '#171719',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackIcon: { color: '#5b5b60', fontSize: 54, fontWeight: '800' },
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
    fontSize: 24,
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

// app/index.tsx
import CategoryRow from '@/components/CategoryRow';
import CloudflareRow from '@/components/CloudflareRow';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';
import FavoriteButton from '@/components/FavoriteButton';
import FavoritesRow from '@/components/FavoritesRow';
import HeroBanner from '@/components/HeroBanner';
import AppBrand from '@/components/AppBrand';
import MainBottomNav from '@/components/MainBottomNav';
import PublicDomainRow from '@/components/PublicDomainRow';
import { CLOUDFLARE_CATEGORIES } from '@/config/cloudflare';
import { APP_NAME, CATEGORIES, CATEGORY_ORDER, CategoryKey } from '@/config/index';
import { fetchCategoryContent } from '@/services/api';
import { PUBLIC_DOMAIN_CATEGORIES } from '@/services/archiveOrg';
import { CloudflareCategory, fetchCloudflareCategories } from '@/services/cloudflareCatalog';
import { getCategoryDisplay } from '@/utils/categoryDisplay';
import { PlaylistEntry } from '@/utils/playlist';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

type SearchResult = PlaylistEntry & { categoryKey: CategoryKey };

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const largeScreen = width >= 900;
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [cloudflareCategories, setCloudflareCategories] = useState<CloudflareCategory[]>(CLOUDFLARE_CATEGORIES);

  // Descobre as categorias Cloudflare publicadas na origem (ver
  // services/cloudflareCatalog.ts) — nenhuma delas vem do código do app,
  // por isso isso roda sempre, sem depender de nada fixo além da lista de
  // fallback inicial (CLOUDFLARE_CATEGORIES, normalmente vazia).
  useEffect(() => {
    let cancelled = false;
    void fetchCloudflareCategories().then((discovered) => {
      if (cancelled || discovered.length === 0) return;
      setCloudflareCategories((current) => {
        const byKey = new Map(current.map((category) => [category.key, category]));
        for (const category of discovered) byKey.set(category.key, category);
        return [...byKey.values()];
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Busca global: quando o usuário digita, buscamos em todas as
  // categorias em paralelo e juntamos os resultados. Como cada
  // categoria já é buscada individualmente pelas CategoryRow (com seu
  // próprio cache de estado), aqui fazemos uma busca independente sob
  // demanda em vez de depender do que cada fileira já carregou.
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const resultsByCategory = await Promise.all(
          CATEGORY_ORDER.map(async (categoryKey) => {
            try {
              const entries = await fetchCategoryContent(categoryKey);
              return entries
                .filter((entry) => entry.title.toLowerCase().includes(query))
                .map((entry) => ({ ...entry, categoryKey }));
            } catch {
              return [];
            }
          })
        );

        if (cancelled) return;
        setSearchResults(resultsByCategory.flat());
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400); // debounce

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const handleItemPress = useCallback(
    (item: SearchResult) => {
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

  const isSearchMode = searchQuery.trim().length >= 2;

  const renderSearchResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const categoryDisplay = getCategoryDisplay(item.categoryKey);
      return (
        <TouchableOpacity
          focusable
          activeOpacity={0.7}
          style={[styles.searchResultCard, largeScreen && styles.searchResultCardLarge]}
          onPress={() => handleItemPress(item)}
        >
          {item.posterUrl ? (
            <Image source={{ uri: item.posterUrl }} style={[styles.searchResultPoster, largeScreen && styles.searchResultPosterLarge]} />
          ) : (
            <View style={[styles.searchResultPoster, largeScreen && styles.searchResultPosterLarge, styles.searchResultPosterFallback]}>
              <Text style={{ fontSize: 20 }}>{categoryDisplay.icon}</Text>
            </View>
          )}
          <View style={styles.searchResultText}>
            <Text style={[styles.searchResultTitle, largeScreen && styles.searchResultTitleLarge]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.searchResultCategory}>{categoryDisplay.label}</Text>
          </View>
          <FavoriteButton
            item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey: item.categoryKey }}
            variant="floating"
            size={16}
          />
          <Ionicons name="chevron-forward" size={18} color="#666" />
        </TouchableOpacity>
      );
    },
    [handleItemPress, largeScreen]
  );

  type HomeListItem =
    | { type: 'legacy'; key: CategoryKey; config: (typeof CATEGORIES)[CategoryKey] }
    | { type: 'public-domain-header' }
    | { type: 'public-domain'; category: (typeof PUBLIC_DOMAIN_CATEGORIES)[number] }
    | { type: 'cloudflare-header' }
    | { type: 'cloudflare'; category: CloudflareCategory };

  const homeList = useMemo<HomeListItem[]>(() => {
    const legacyItems: HomeListItem[] = CATEGORY_ORDER.map((key) => ({
      type: 'legacy',
      key,
      config: CATEGORIES[key],
    }));
    const publicDomainItems: HomeListItem[] = PUBLIC_DOMAIN_CATEGORIES.map((category) => ({
      type: 'public-domain',
      category,
    }));
    // Vazio até o manifesto (GET /catalog) trazer alguma categoria — não
    // adiciona nenhuma fileira (nem cabeçalho) enquanto isso não acontecer.
    const cloudflareItems: HomeListItem[] = cloudflareCategories.map((category) => ({
      type: 'cloudflare',
      category,
    }));
    return [
      ...legacyItems,
      { type: 'public-domain-header' },
      ...publicDomainItems,
      ...(cloudflareItems.length > 0 ? [{ type: 'cloudflare-header' } as HomeListItem, ...cloudflareItems] : []),
    ];
  }, [cloudflareCategories]);

  const renderHomeItem = useCallback(({ item }: { item: HomeListItem }) => {
    if (item.type === 'legacy') {
      return <CategoryRow categoryKey={item.key} config={item.config} />;
    }
    if (item.type === 'public-domain') {
      return <PublicDomainRow category={item.category} />;
    }
    if (item.type === 'cloudflare') {
      return <CloudflareRow category={item.category} />;
    }
    if (item.type === 'cloudflare-header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderTitle}>Mais conteúdos</Text>
        </View>
      );
    }
    // 'public-domain-header'
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}> Domínio Público</Text>
        <Text style={styles.sectionHeaderSubtitle}>
          Filmes e curtas do archive.org
        </Text>
      </View>
    );
  }, []);

  const homeKeyExtractor = useCallback((item: HomeListItem, index: number) => {
    if (item.type === 'legacy') return `legacy-${item.key}`;
    if (item.type === 'public-domain') return `pd-${item.category.key}`;
    if (item.type === 'cloudflare') return `cf-${item.category.key}`;
    return `pd-header-${index}`;
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 54 : largeScreen ? 20 : 44 }]}>
        <AppBrand />
        <TouchableOpacity
          focusable
          accessibilityRole="button"
          accessibilityLabel="Abrir definições"
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={21} color="#f2f2f4" />
        </TouchableOpacity>
      </View>

      {/* Barra de pesquisa */}
      <View style={[styles.searchContainer, largeScreen && styles.searchContainerLarge]}>
        <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, largeScreen && styles.searchInputLarge]}
          placeholder="Buscar filmes, séries, animes..."
          placeholderTextColor="#8e8e93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity focusable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8e8e93" />
          </TouchableOpacity>
        )}
      </View>

      {isSearchMode ? (
        // ── Modo busca: lista plana de resultados de todas as categorias ──
        searching ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.loadingText}>Buscando...</Text>
          </View>
        ) : searchResults && searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `${item.categoryKey}-${index}-${item.url}`}
            renderItem={renderSearchResult}
            contentContainerStyle={styles.searchResultsList}
          />
        ) : (
          <View style={styles.centerContent}>
            <Ionicons name="search-outline" size={48} color="#48484a" />
            <Text style={styles.emptyText}>Nenhum resultado para &quot;{searchQuery}&quot;</Text>
          </View>
        )
      ) : (
        // ── Modo normal: hero + minha lista + categorias + domínio público ──
        <FlatList
          data={homeList}
          keyExtractor={homeKeyExtractor}
          renderItem={renderHomeItem}
          ListHeaderComponent={
            <>
              <HeroBanner />
              <ContinueWatchingRow />
            </>
          }
          contentContainerStyle={styles.categoriesList}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        />
      )}
      <MainBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 10,
  },
  settingsButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#19191c',
    borderWidth: 1,
    borderColor: '#303034',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  searchContainerLarge: { minHeight: 54, borderRadius: 12, marginHorizontal: 28 },
  searchInputLarge: { height: 52, fontSize: 18 },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 15,
    color: '#fff',
  },
  categoriesList: {
    paddingBottom: 30,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  sectionHeaderTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionHeaderSubtitle: {
    color: '#8e8e93',
    fontSize: 12,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8e8e93',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
  },
  searchResultsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#1c1c1e',
    borderRadius: 10,
    padding: 8,
  },
  searchResultPoster: {
    width: 46,
    height: 66,
    borderRadius: 6,
    backgroundColor: '#2c2c2e',
  },
  searchResultCardLarge: { minHeight: 88, padding: 12, borderRadius: 12 },
  searchResultPosterLarge: { width: 62, height: 88 },
  searchResultPosterFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultText: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultTitleLarge: { fontSize: 17 },
  searchResultTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchResultCategory: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 2,
  },
});

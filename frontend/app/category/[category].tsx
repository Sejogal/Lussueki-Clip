import FavoriteButton from '@/components/FavoriteButton';
import AppBrand from '@/components/AppBrand';
import { CATEGORIES, CategoryKey } from '@/config';
import { fetchCategoryContent } from '@/services/api';
import { PlaylistEntry } from '@/utils/playlist';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, value);
}

type CategoryCardProps = {
  item: PlaylistEntry;
  categoryKey: CategoryKey;
  width: number;
  largeScreen: boolean;
  onPress: (item: PlaylistEntry) => void;
};

const CategoryCard = React.memo(function CategoryCard({ item, categoryKey, width, largeScreen, onPress }: CategoryCardProps) {
  const [focused, setFocused] = useState(false);
  const height = Math.round(width / 0.7);
  return (
    <TouchableOpacity
      focusable
      style={[styles.card, { width }, focused && styles.cardFocused]}
      activeOpacity={0.78}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(item)}
    >
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={[styles.poster, { width, height }]} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback, { width, height }]}>
            <Ionicons name="film-outline" size={largeScreen ? 42 : 30} color="#77777d" />
          </View>
        )}
        <FavoriteButton item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey }} variant="overlay" />
      </View>
      <Text style={[styles.cardTitle, largeScreen && styles.cardTitleLarge]} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );
});

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = Math.min(windowWidth, 1600);
  const columnCount = windowWidth >= 1440 ? 6 : windowWidth >= 1100 ? 5 : windowWidth >= 800 ? 4 : windowWidth >= 600 ? 3 : 2;
  const cardWidth = (contentWidth - 32 - (columnCount - 1) * 16) / columnCount;
  const largeScreen = windowWidth >= 900;
  const categoryKey = useMemo(() => {
    const value = Array.isArray(params.category) ? params.category[0] : params.category;
    return value && isCategoryKey(value) ? value : null;
  }, [params.category]);
  const [items, setItems] = useState<PlaylistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!categoryKey) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setItems(await fetchCategoryContent(categoryKey));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryKey]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const handlePress = useCallback((item: PlaylistEntry) => {
    if (!categoryKey) return;
    router.push({
      pathname: '/preview',
      params: {
        streamUrl: item.url,
        title: item.title,
        posterUrl: item.posterUrl ?? '',
        categoryKey,
      },
    });
  }, [categoryKey, router]);

  const renderItem = useCallback(({ item }: { item: PlaylistEntry }) => (
    categoryKey ? <CategoryCard item={item} categoryKey={categoryKey} width={cardWidth} largeScreen={largeScreen} onPress={handlePress} /> : null
  ), [categoryKey, cardWidth, handlePress, largeScreen]);

  const keyExtractor = useCallback((item: PlaylistEntry, index: number) => `${index}-${item.url}`, []);
  const config = categoryKey ? CATEGORIES[categoryKey] : null;

  return (
    <SafeAreaView style={[styles.container, { maxWidth: 1600 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          focusable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <AppBrand />
          <Text style={[styles.title, largeScreen && styles.titleLarge]}>{config ? `${config.icon}  ${config.label}` : 'Categoria'}</Text>
          <Text style={styles.subtitle}>{items.length} títulos disponíveis</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.stateText}>Carregando conteúdo...</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Ionicons name="cloud-offline-outline" size={34} color="#8e8e93" />
          <Text style={styles.stateText}>Não foi possível carregar esta categoria.</Text>
          <TouchableOpacity focusable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.state}>
          <Ionicons name="film-outline" size={34} color="#77777d" />
          <Text style={styles.stateText}>Nenhum título disponível no momento.</Text>
        </View>
      ) : (
        <FlatList
          key={`columns-${columnCount}`}
          data={items}
          numColumns={columnCount}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignSelf: 'center', backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#19191c' },
  headerText: { flex: 1, marginLeft: 12 },
  titleLarge: { fontSize: 23 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#96969d', fontSize: 12, marginTop: 3 },
  grid: { paddingHorizontal: 16, paddingBottom: 28 },
  row: { gap: 16 },
  card: { marginBottom: 18, borderRadius: 10, padding: 2 },
  cardFocused: { backgroundColor: '#29292d', borderColor: '#fff', borderWidth: 2, transform: [{ scale: 1.04 }], zIndex: 2 },
  posterWrapper: { position: 'relative' },
  poster: { aspectRatio: 0.7, borderRadius: 8, backgroundColor: '#1c1c1e' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#e5e5e7', fontSize: 13, lineHeight: 17, fontWeight: '600', marginTop: 7 },
  cardTitleLarge: { fontSize: 17, lineHeight: 22 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateText: { color: '#a1a1a8', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  retryButton: { backgroundColor: '#d91620', borderRadius: 7, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

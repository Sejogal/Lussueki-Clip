import FavoriteButton from '@/components/FavoriteButton';
import { CATEGORIES, CategoryKey } from '@/config';
import { fetchCategoryContent } from '@/services/api';
import { PlaylistEntry } from '@/utils/playlist';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_COUNT = SCREEN_WIDTH >= 700 ? 3 : 2;
const CARD_WIDTH = (SCREEN_WIDTH - 32 - (COLUMN_COUNT - 1) * 12) / COLUMN_COUNT;

function isCategoryKey(value: string): value is CategoryKey {
  return Object.prototype.hasOwnProperty.call(CATEGORIES, value);
}

export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const router = useRouter();
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
    <TouchableOpacity style={styles.card} activeOpacity={0.78} onPress={() => handlePress(item)}>
      <View style={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Ionicons name="film-outline" size={30} color="#77777d" />
          </View>
        )}
        {categoryKey && (
          <FavoriteButton
            item={{ title: item.title, url: item.url, posterUrl: item.posterUrl, categoryKey }}
            variant="overlay"
          />
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  ), [categoryKey, handlePress]);

  const keyExtractor = useCallback((item: PlaylistEntry, index: number) => `${index}-${item.url}`, []);
  const config = categoryKey ? CATEGORIES[categoryKey] : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{config ? `${config.icon}  ${config.label}` : 'Categoria'}</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
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
          key={`columns-${COLUMN_COUNT}`}
          data={items}
          numColumns={COLUMN_COUNT}
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
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#19191c' },
  headerText: { flex: 1, marginLeft: 12 },
  title: { color: '#fff', fontSize: 19, fontWeight: '800' },
  subtitle: { color: '#96969d', fontSize: 12, marginTop: 3 },
  grid: { paddingHorizontal: 16, paddingBottom: 28 },
  row: { gap: 12 },
  card: { width: CARD_WIDTH, marginBottom: 18 },
  posterWrapper: { position: 'relative' },
  poster: { width: CARD_WIDTH, aspectRatio: 0.7, borderRadius: 8, backgroundColor: '#1c1c1e' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#e5e5e7', fontSize: 13, lineHeight: 17, fontWeight: '600', marginTop: 7 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  stateText: { color: '#a1a1a8', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  retryButton: { backgroundColor: '#d91620', borderRadius: 7, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

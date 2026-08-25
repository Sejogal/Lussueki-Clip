// app/iptv/index.tsx
import ChannelRow from '@/components/ChannelRow';
import { fetchIptvCatalog } from '@/services/iptv';
import { IptvCategory, IptvChannel } from '@/utils/iptv';
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
} from 'react-native';

export default function IptvScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<IptvCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIptvCatalog();
      setCategories(data);
    } catch (err) {
      console.error('❌ Erro ao carregar catálogo IPTV:', err);
      setError('Não foi possível carregar os canais. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChannelPress = useCallback(
    (channel: IptvChannel) => {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: channel.url,
          title: channel.title,
          posterUrl: channel.posterUrl ?? '',
          categoryKey: `iptv:${channel.group}`,
        },
      });
    },
    [router]
  );

  // Busca simples: varre todas as categorias já carregadas em memória
  // (sem nova requisição de rede, já que o catálogo inteiro já está
  // no cache do services/iptv.ts).
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2 || !categories) return null;

    const results: IptvChannel[] = [];
    for (const category of categories) {
      for (const channel of category.channels) {
        if (channel.title.toLowerCase().includes(query)) {
          results.push(channel);
        }
      }
    }
    return results;
  }, [searchQuery, categories]);

  const renderSearchResult = useCallback(
    ({ item }: { item: IptvChannel }) => (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.searchResultCard}
        onPress={() => handleChannelPress(item)}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.searchResultLogo} resizeMode="contain" />
        ) : (
          <View style={[styles.searchResultLogo, styles.searchResultLogoFallback]}>
            <Text style={{ fontSize: 18 }}>📺</Text>
          </View>
        )}
        <View style={styles.searchResultText}>
          <Text style={styles.searchResultTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.searchResultCategory}>{item.group}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#666" />
      </TouchableOpacity>
    ),
    [handleChannelPress]
  );

  const isSearchMode = searchQuery.trim().length >= 2;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📺 TV ao vivo</Text>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8e8e93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canal..."
          placeholderTextColor="#8e8e93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8e8e93" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loadingText}>Carregando canais...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContent}>
          <Ionicons name="cloud-offline" size={48} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : isSearchMode ? (
        searchResults && searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, index) => `${index}-${item.url}`}
            renderItem={renderSearchResult}
            contentContainerStyle={styles.searchResultsList}
          />
        ) : (
          <View style={styles.centerContent}>
            <Ionicons name="search-outline" size={48} color="#48484a" />
            <Text style={styles.emptyText}>Nenhum canal encontrado para "{searchQuery}"</Text>
          </View>
        )
      ) : (
        <FlatList
          data={categories ?? []}
          keyExtractor={(item) => item.group}
          renderItem={({ item }) => <ChannelRow category={item} />}
          contentContainerStyle={styles.categoriesList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 54 : 44,
    paddingBottom: 10,
    gap: 6,
  },
  backButton: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
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
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#8e8e93',
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: '#ff6b6b',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    fontSize: 15,
    color: '#8e8e93',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
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
  searchResultLogo: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: '#2c2c2e',
  },
  searchResultLogoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultText: {
    flex: 1,
    marginLeft: 12,
  },
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
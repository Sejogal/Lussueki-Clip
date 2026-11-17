import { useAuth } from '@/contexts/AuthContext';
import { HistoryItem } from '@/services/auth';
import { normalizePosterUrl } from '@/utils/tmdb';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

export default function ContinueWatchingRow() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const largeScreen = width >= 900;
  const { history } = useAuth();

  const openItem = useCallback((item: HistoryItem) => {
    router.push({
      pathname: '/player',
      params: {
        streamUrl: item.source_url,
        title: item.title,
        posterUrl: item.poster_url ?? '',
        categoryKey: item.category ?? '',
        positionSeconds: String(item.position_seconds ?? 0),
      },
    });
  }, [router]);

  if (history.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, largeScreen && styles.titleLarge]}>Continuar assistindo</Text>
      <FlatList
        data={history}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.content_key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <ContinueItem item={item} largeScreen={largeScreen} onPress={openItem} />}
        removeClippedSubviews={!largeScreen}
      />
    </View>
  );
}

function ContinueItem({ item, largeScreen, onPress }: { item: HistoryItem; largeScreen: boolean; onPress: (item: HistoryItem) => void }) {
  const [focused, setFocused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const posterUrl = normalizePosterUrl(item.poster_url ?? undefined);
  // Sem duração conhecida ainda (primeiros segundos de reprodução) não dá
  // pra calcular uma percentagem real — mostra a barra cheia só quando
  // houver os dois valores.
  const progressPct = item.duration_seconds
    ? Math.min(100, Math.round(((item.position_seconds ?? 0) / item.duration_seconds) * 100))
    : null;
  return (
    <TouchableOpacity
      focusable
      style={[styles.item, largeScreen && styles.itemLarge, focused && styles.itemFocused]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(item)}
    >
      <View style={[styles.poster, largeScreen && styles.posterLarge]}>
        {posterUrl && !imageFailed ? (
          <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" onError={() => setImageFailed(true)} />
        ) : (
          <View style={[styles.posterImage, styles.posterFallback]}>
            <Text style={styles.posterFallbackIcon}>▶</Text>
          </View>
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct ?? 4}%` }]} />
        </View>
      </View>
      <Text style={[styles.itemTitle, largeScreen && styles.itemTitleLarge]} numberOfLines={2}>{item.title}</Text>
      <Text style={[styles.progress, largeScreen && styles.progressLarge]}>
        {progressPct !== null ? `${progressPct}% assistido` : 'Retomar'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16, gap: 12 },
  item: { width: 180, borderRadius: 10, overflow: 'visible' },
  itemLarge: { width: 260 },
  itemFocused: { transform: [{ scale: 1.04 }], zIndex: 2 },
  titleLarge: { fontSize: 21 },
  poster: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1c1c1e' },
  posterLarge: { borderRadius: 10 },
  posterImage: { width: '100%', height: '100%' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackIcon: { color: '#5b5b60', fontSize: 28 },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  progressFill: { height: '100%', backgroundColor: '#e50914' },
  itemTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginTop: 8 },
  itemTitleLarge: { fontSize: 16 },
  progress: { color: '#8e8e93', fontSize: 11, marginTop: 2 },
  progressLarge: { fontSize: 13 },
});

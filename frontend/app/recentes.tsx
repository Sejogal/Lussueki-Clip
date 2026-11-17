import { useAuth } from '@/contexts/AuthContext';
import { HistoryItem } from '@/services/auth';
import { normalizePosterUrl } from '@/utils/tmdb';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecentesScreen() {
  const router = useRouter();
  const { session, history } = useAuth();

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
          <Text style={styles.title}>Recentes</Text>
          <Text style={styles.subtitle}>O que começaste a ver</Text>
        </View>
      </View>

      {!session ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Inicia sessão para ver os teus recentes</Text>
          <Text style={styles.emptyDescription}>O teu histórico fica guardado na tua conta, em qualquer dispositivo.</Text>
          <Text style={styles.emptyAction} onPress={() => router.push('/auth')}>Entrar</Text>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🕘</Text>
          <Text style={styles.emptyTitle}>Ainda não começaste nada</Text>
          <Text style={styles.emptyDescription}>O que fores assistindo aparece aqui, com o progresso guardado.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.content_key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RecentRow item={item} onPress={openItem} />}
        />
      )}
    </SafeAreaView>
  );
}

function RecentRow({ item, onPress }: { item: HistoryItem; onPress: (item: HistoryItem) => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const posterUrl = normalizePosterUrl(item.poster_url ?? undefined);
  // Sem duração conhecida ainda (primeiros segundos de reprodução) não dá
  // pra calcular uma percentagem real — mostra a barra quase vazia só
  // pra indicar "já começou", sem inventar um número.
  const progressPct = item.duration_seconds
    ? Math.min(100, Math.round(((item.position_seconds ?? 0) / item.duration_seconds) * 100))
    : null;
  return (
    <TouchableOpacity style={styles.row} onPress={() => onPress(item)}>
      <View style={styles.rowPoster}>
        {posterUrl && !imageFailed ? (
          <Image source={{ uri: posterUrl }} style={styles.rowPosterImage} resizeMode="cover" onError={() => setImageFailed(true)} />
        ) : (
          <View style={[styles.rowPosterImage, styles.rowPosterFallback]}>
            <Text style={styles.rowPosterFallbackIcon}>▶</Text>
          </View>
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct ?? 4}%` }]} />
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.rowProgress}>
          {progressPct !== null ? `${progressPct}% assistido` : 'Retomar'}
        </Text>
      </View>
      <Ionicons name="play-circle" size={30} color="#e50914" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2e' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#19191c' },
  headerText: { marginLeft: 13 },
  title: { color: '#fff', fontSize: 19, lineHeight: 25, fontWeight: '800', marginTop: 3 },
  subtitle: { color: '#a1a1a8', fontSize: 13, lineHeight: 18, marginTop: 3 },
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#17171a', borderRadius: 10, padding: 10, marginBottom: 12 },
  rowPoster: { width: 110, aspectRatio: 16 / 9, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1c1c1e' },
  rowPosterImage: { width: '100%', height: '100%' },
  rowPosterFallback: { alignItems: 'center', justifyContent: 'center' },
  rowPosterFallbackIcon: { color: '#5b5b60', fontSize: 22 },
  progressTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: '100%', backgroundColor: '#e50914' },
  rowText: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowProgress: { color: '#8e8e93', fontSize: 12, marginTop: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6 },
  emptyIcon: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyDescription: { color: '#8e8e93', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  emptyAction: { color: '#e50914', fontSize: 15, fontWeight: '700', marginTop: 14, paddingVertical: 8, paddingHorizontal: 18 },
});

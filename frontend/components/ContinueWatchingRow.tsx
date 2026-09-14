import { useAuth } from '@/contexts/AuthContext';
import { HistoryItem } from '@/services/auth';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ContinueWatchingRow() {
  const router = useRouter();
  const { history } = useAuth();

  const openItem = useCallback((item: HistoryItem) => {
    router.push({
      pathname: '/player',
      params: {
        streamUrl: item.source_url,
        title: item.title,
        categoryKey: item.category ?? '',
        positionSeconds: String(item.position_seconds),
      },
    });
  }, [router]);

  if (history.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Continuar assistindo</Text>
      <FlatList
        data={history}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.content_key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => openItem(item)}>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.progress}>
              {item.duration_seconds ? `${Math.round((item.position_seconds / item.duration_seconds) * 100)}% assistido` : 'Retomar'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16, gap: 10 },
  item: { width: 180, minHeight: 78, justifyContent: 'center', backgroundColor: '#1c1c1e', borderRadius: 8, padding: 12 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progress: { color: '#8e8e93', fontSize: 12, marginTop: 8 },
});
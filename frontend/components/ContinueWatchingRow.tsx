import { useAuth } from '@/contexts/AuthContext';
import { HistoryItem } from '@/services/auth';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

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
  return (
          <TouchableOpacity focusable style={[styles.item, largeScreen && styles.itemLarge, focused && styles.itemFocused]} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={() => onPress(item)}>
            <Text style={[styles.itemTitle, largeScreen && styles.itemTitleLarge]} numberOfLines={2}>{item.title}</Text>
            <Text style={[styles.progress, largeScreen && styles.progressLarge]}>

              {item.duration_seconds ? `${Math.round(((item.position_seconds ?? 0) / item.duration_seconds) * 100)}% assistido` : 'Retomar'}
            </Text>
          </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 22 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 },
  list: { paddingHorizontal: 16, gap: 10 },
  item: { width: 180, minHeight: 78, justifyContent: 'center', backgroundColor: '#1c1c1e', borderRadius: 8, padding: 12 },
  itemLarge: { width: 260, minHeight: 106, padding: 18 },
  itemFocused: { borderWidth: 2, borderColor: '#fff', backgroundColor: '#29292d', transform: [{ scale: 1.04 }], zIndex: 2 },
  titleLarge: { fontSize: 21 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  progress: { color: '#8e8e93', fontSize: 12, marginTop: 8 },
  itemTitleLarge: { fontSize: 18 },
  progressLarge: { fontSize: 15 },
});
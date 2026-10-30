import { listDownloads, removeDownload } from '@/services/downloads';
import type { DownloadedMedia } from '@/services/downloads';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DownloadsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<DownloadedMedia[]>([]);
  const refresh = useCallback(() => { void listDownloads().then(setItems); }, []);
  useFocusEffect(refresh);

  const handleRemove = useCallback((item: DownloadedMedia) => {
    Alert.alert('Apagar download?', '“' + item.title + '” será removido deste dispositivo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => void removeDownload(item.url).then(refresh) },
    ]);
  }, [refresh]);

  const play = (item: DownloadedMedia) => router.push({
    pathname: '/player',
    params: { streamUrl: item.url, title: item.title, categoryKey: 'download' },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityLabel="Voltar" style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Downloads</Text>
          <Text style={styles.subtitle}>Disponíveis apenas neste app</Text>
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.url}
        contentContainerStyle={items.length ? styles.list : styles.empty}
        ListEmptyComponent={<Text style={styles.emptyText}>Ainda não há conteúdos baixados.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity accessibilityRole="button" style={styles.playButton} onPress={() => play(item)}>
              <Ionicons name="play" size={19} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.itemText} onPress={() => play(item)}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.itemDate}>Guardado em {new Date(item.savedAt).toLocaleDateString()}</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel={'Apagar ' + item.title} style={styles.removeButton} onPress={() => handleRemove(item)}>
              <Ionicons name="trash-outline" size={19} color="#ff777d" />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2e' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#19191c' },
  headerText: { marginLeft: 13 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#96969d', fontSize: 12, marginTop: 2 },
  list: { padding: 16 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: '#a1a1a8', fontSize: 14, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151517', borderRadius: 10, padding: 12, marginBottom: 10, gap: 12 },
  playButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d91620', alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, gap: 4 },
  itemTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemDate: { color: '#929299', fontSize: 11 },
  removeButton: { padding: 9 },
});

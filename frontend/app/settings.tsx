import AppBrand from '@/components/AppBrand';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearDeviceCache } from '@/services/deviceCache';
import { invalidateIptvCache } from '@/services/iptv';

const PORTFOLIO_URL = 'https://portfolio-m7sj.onrender.com/';

export default function SettingsScreen() {
  const router = useRouter();
  const [clearingCache, setClearingCache] = useState(false);

  const openPortfolio = async () => {
    try {
      await Linking.openURL(PORTFOLIO_URL);
    } catch {
      Alert.alert('Não foi possível abrir o portfólio', 'Verifique sua conexão e tente novamente.');
    }
  };

  const confirmClearCache = () => {
    Alert.alert(
      'Limpar cache de conteúdo?',
      'As listas de filmes, séries, animes e TV ao vivo já guardadas neste aparelho serão apagadas — na próxima vez que você abrir cada uma, ela será buscada de novo do servidor.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => {
            setClearingCache(true);
            void clearDeviceCache()
              .then(() => invalidateIptvCache())
              .finally(() => setClearingCache(false));
          },
        },
      ]
    );
  };

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
          <AppBrand />
          <Text style={styles.title}>Definições</Text>
          <Text style={styles.subtitle}>Sobre o aplicativo</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionEyebrow}>LUSSUEKI CLIP</Text>
        <Text style={styles.introTitle}>Entretenimento em um só lugar.</Text>
        <Text style={styles.introText}>
          Um projeto independente para reunir filmes, séries, animes e canais ao vivo em uma experiência simples de explorar.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Armazenamento</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.storageRow}
            disabled={clearingCache}
            onPress={confirmClearCache}
          >
            <View style={[styles.storageIcon, styles.cacheIcon]}>
              {clearingCache ? <ActivityIndicator size="small" color="#8fd3ff" /> : <Ionicons name="trash-outline" size={18} color="#8fd3ff" />}
            </View>
            <View style={styles.storageTextGroup}>
              <Text style={styles.storageTitle}>Limpar cache de conteúdo</Text>
              <Text style={styles.storageSubtitle}>Força recarregar as listas do servidor</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre o desenvolvedor</Text>
          <View style={styles.developerPanel}>
            <View style={styles.developerIcon}>
              <Ionicons name="code-slash-outline" size={21} color="#ff777d" />
            </View>
            <Text style={styles.developerTitle}>Conheça meu trabalho</Text>
            <Text style={styles.developerDescription}>
              Veja outros projetos, experiências e criações no meu portfólio.
            </Text>
            <TouchableOpacity
              accessibilityRole="link"
              style={styles.portfolioButton}
              onPress={() => void openPortfolio()}
            >
              <Text style={styles.portfolioButtonText}>Visitar portfólio</Text>
              <Ionicons name="open-outline" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.versionRow}>
          <View style={styles.versionIcon}>
            <Ionicons name="information-circle-outline" size={19} color="#a1a1a8" />
          </View>
          <Text style={styles.versionLabel}>Versão do aplicativo</Text>
          <Text style={styles.versionValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', backgroundColor: '#09090b' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2e' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#19191c' },
  headerText: { marginLeft: 13 },
  title: { color: '#fff', fontSize: 19, lineHeight: 25, fontWeight: '800', marginTop: 3 },
  subtitle: { color: '#a1a1a8', fontSize: 13, lineHeight: 18, marginTop: 3 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  sectionEyebrow: { color: '#ff777d', fontSize: 11, fontWeight: '800', marginBottom: 9 },
  introTitle: { color: '#fff', fontSize: 25, lineHeight: 31, fontWeight: '800', maxWidth: 320 },
  introText: { color: '#a1a1a8', fontSize: 14, lineHeight: 21, marginTop: 10 },
  section: { marginTop: 32 },
  sectionTitle: { color: '#f4f4f5', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  storageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, backgroundColor: '#151517', borderWidth: 1, borderColor: '#2a2a2e', borderRadius: 9, paddingHorizontal: 14 },
  storageIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cacheIcon: { backgroundColor: '#17262e' },
  storageTextGroup: { flex: 1 },
  storageTitle: { color: '#f5f5f6', fontSize: 14, fontWeight: '700' },
  storageSubtitle: { color: '#96969d', fontSize: 12, marginTop: 3 },
  developerPanel: { backgroundColor: '#151517', borderWidth: 1, borderColor: '#2a2a2e', borderRadius: 10, padding: 17 },
  developerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#302023', marginBottom: 14 },
  developerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  developerDescription: { color: '#a1a1a8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  portfolioButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#d91620', borderRadius: 7, marginTop: 17, paddingHorizontal: 14 },
  portfolioButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  versionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 55, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2a2a2e', marginTop: 24 },
  versionIcon: { width: 30, alignItems: 'flex-start' },
  versionLabel: { flex: 1, color: '#d8d8db', fontSize: 13 },
  versionValue: { color: '#96969d', fontSize: 13 },
});

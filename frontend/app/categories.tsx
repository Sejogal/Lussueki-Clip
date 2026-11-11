import CategoryRow from '@/components/CategoryRow';
import AppBrand from '@/components/AppBrand';
import MainBottomNav from '@/components/MainBottomNav';
import { CATEGORIES, CATEGORY_ORDER } from '@/config';
import React, { useCallback } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';

export default function CategoriesScreen() {
  const renderCategory = useCallback(
    ({ item }: { item: (typeof CATEGORY_ORDER)[number] }) => <CategoryRow categoryKey={item} config={CATEGORIES[item]} />,
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppBrand />
        <Text style={styles.title}>Categorias</Text>
        <Text style={styles.subtitle}>Encontre filmes, séries, animes e mais.</Text>
      </View>
      <FlatList data={CATEGORY_ORDER} keyExtractor={(category) => category} renderItem={renderCategory} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />
      <MainBottomNav active="categories" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', backgroundColor: '#000' },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 3 },
  subtitle: { color: '#a1a1a8', fontSize: 13, lineHeight: 18, marginTop: 3 },
  list: { paddingBottom: 14 },
});

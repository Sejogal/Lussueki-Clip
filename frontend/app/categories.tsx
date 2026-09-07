import CategoryRow from '@/components/CategoryRow';
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
        <Text style={styles.title}>Categorias</Text>
        <Text style={styles.subtitle}>Encontre filmes, séries, animes e mais.</Text>
      </View>
      <FlatList data={CATEGORY_ORDER} keyExtractor={(category) => category} renderItem={renderCategory} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />
      <MainBottomNav active="categories" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#8e8e93', fontSize: 14, marginTop: 4 },
  list: { paddingBottom: 14 },
});

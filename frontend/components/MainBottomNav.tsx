import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MainRoute = 'home' | 'categories' | 'iptv' | 'favoritos' | 'account';
type NavItemProps = {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  largeScreen: boolean;
};

function NavItem({ active, icon, label, onPress, largeScreen }: NavItemProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TouchableOpacity
      focusable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[styles.item, largeScreen && styles.itemLarge, focused && styles.itemFocused]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
    >
      <Ionicons name={icon} size={largeScreen ? 28 : 22} color={active ? '#e50914' : '#8e8e93'} />
      <Text style={[styles.label, largeScreen && styles.labelLarge, active && styles.activeLabel]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MainBottomNav({ active }: { active: MainRoute }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const largeScreen = width >= 900;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const openLiveTv = () => {
    if (!session) {
      router.push({ pathname: '/auth', params: { redirect: '/iptv' } });
      return;
    }
    router.replace('/iptv' as Href);
  };

  const navItem = (tab: MainRoute, icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void) => (
    <NavItem largeScreen={largeScreen} active={active === tab} icon={icon} label={label} onPress={onPress} />
  );

  return (
    <View style={[styles.bar, largeScreen && styles.barLarge, { paddingBottom: Math.max(insets.bottom, largeScreen ? 16 : 10) }]}>
      {navItem('home', 'home-outline', 'Início', () => router.replace('/'))}
      {navItem('categories', 'grid-outline', 'Categorias', () => router.replace('/categories' as Href))}
      {navItem('iptv', 'tv-outline', 'TV ao vivo', openLiveTv)}
      {navItem('favoritos', 'heart', 'Favoritos', () => router.replace('/favoritos' as Href))}
      {navItem('account', 'person-outline', session ? 'Conta' : 'Entrar', () => router.push('/auth' as Href))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#111113', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#38383a', paddingTop: 10, paddingHorizontal: 4 },
  barLarge: { maxWidth: 1600, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 46, borderRadius: 10, paddingVertical: 4 },
  itemLarge: { minHeight: 64, gap: 5, paddingVertical: 8 },
  itemFocused: { backgroundColor: '#29292d', borderWidth: 2, borderColor: '#f2f2f4' },
  label: { color: '#8e8e93', fontSize: 11, fontWeight: '600' },
  labelLarge: { fontSize: 14 },
  activeLabel: { color: '#fff' },
});

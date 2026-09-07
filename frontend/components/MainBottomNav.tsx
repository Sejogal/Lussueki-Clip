import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Href, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type MainRoute = 'home' | 'categories' | 'iptv' | 'favoritos';

type NavItemProps = {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
};

function NavItem({ active, icon, label, onPress }: NavItemProps) {
  return (
    <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} style={styles.item} onPress={onPress}>
      <Ionicons name={icon} size={22} color={active ? '#e50914' : '#8e8e93'} />
      <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MainBottomNav({ active }: { active: MainRoute }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <NavItem active={active === 'home'} icon="home-outline" label="Home" onPress={() => router.replace('/')} />
      <NavItem active={active === 'categories'} icon="grid-outline" label="Categorias" onPress={() => router.replace('/categories' as Href)} />
      <NavItem active={active === 'iptv'} icon="tv-outline" label="TV ao vivo" onPress={() => router.replace('/iptv' as Href)} />
      <NavItem active={active === 'favoritos'} icon="heart" label="Favoritos" onPress={() => router.replace('/favoritos' as Href)} />
      <NavItem active={false} icon="person-outline" label={session ? 'Conta' : 'Entrar'} onPress={() => router.push('/auth' as Href)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#111113', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#38383a', paddingTop: 10, paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', gap: 3, minHeight: 46 },
  label: { color: '#8e8e93', fontSize: 11, fontWeight: '600' },
  activeLabel: { color: '#fff' },
});

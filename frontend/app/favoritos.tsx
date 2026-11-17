import { ActivityIndicator, Text, StyleSheet, View, Platform } from "react-native";
import FavoritesRow from '@/components/FavoritesRow';
import MainBottomNav from '@/components/MainBottomNav';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useRouter } from 'expo-router';

export default function Favoritos() {
    const router = useRouter();
    const { session } = useAuth();
    const { favorites, loading } = useFavorites();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Favoritos</Text>
                <Text style={styles.subtitle}>Encontre o teu entretenimento favorito.</Text>
            </View>

            {!session ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>🔒</Text>
                    <Text style={styles.emptyTitle}>Inicia sessão para ver os teus favoritos</Text>
                    <Text style={styles.emptyDescription}>A tua lista fica guardada na tua conta, em qualquer dispositivo.</Text>
                    <Text style={styles.emptyAction} onPress={() => router.push('/auth')}>Entrar</Text>
                </View>
            ) : loading ? (
                <View style={styles.emptyState}>
                    <ActivityIndicator color="#e50914" />
                </View>
            ) : favorites.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>❤️</Text>
                    <Text style={styles.emptyTitle}>Ainda não tens favoritos</Text>
                    <Text style={styles.emptyDescription}>Toca no coração em qualquer título para o guardar aqui.</Text>
                </View>
            ) : (
                <FavoritesRow />
            )}

            <View style={styles.bottomComponent}>
                <MainBottomNav active="favoritos" />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', backgroundColor: '#000' },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 16 },
    title: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 3 },
    subtitle: { color: '#a1a1a8', fontSize: 13, lineHeight: 18, marginTop: 3 },
    list: { paddingBottom: 14 },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80,
        gap: 6,
    },
    emptyIcon: { fontSize: 44, marginBottom: 8 },
    emptyTitle: { color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' },
    emptyDescription: { color: '#8e8e93', fontSize: 13, textAlign: 'center', lineHeight: 18 },
    emptyAction: { color: '#e50914', fontSize: 15, fontWeight: '700', marginTop: 14, paddingVertical: 8, paddingHorizontal: 18 },
    bottomComponent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});

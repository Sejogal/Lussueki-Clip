import { Text, ScrollView, TouchableOpacity, StyleSheet, View, Platform } from "react-native";
import FavoritesRow from '@/components/FavoritesRow';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import MainBottomNav from '@/components/MainBottomNav';


export default function favoritos() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Favoritos</Text>
                <Text style={styles.subtitle}>Encontre o teu entretenimento favorito.</Text>
            </View>
            <FavoritesRow />
            <View style={styles.bottomComponent}>
                <MainBottomNav active="favoritos" />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 16 },
    title: { color: '#fff', fontSize: 28, fontWeight: '800' },
    subtitle: { color: '#8e8e93', fontSize: 14, marginTop: 4 },
    list: { paddingBottom: 14 },
    bottomComponent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});

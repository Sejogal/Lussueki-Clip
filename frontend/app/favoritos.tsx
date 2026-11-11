import { Text, ScrollView, TouchableOpacity, StyleSheet, View, Platform } from "react-native";
import FavoritesRow from '@/components/FavoritesRow';
import AppBrand from '@/components/AppBrand';
import { router, useLocalSearchParams, useRouter } from 'expo-router';
import MainBottomNav from '@/components/MainBottomNav';


export default function favoritos() {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <AppBrand />
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
    container: { flex: 1, width: '100%', maxWidth: 1600, alignSelf: 'center', backgroundColor: '#000' },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 44, paddingBottom: 16 },
    title: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800', marginTop: 3 },
    subtitle: { color: '#a1a1a8', fontSize: 13, lineHeight: 18, marginTop: 3 },
    list: { paddingBottom: 14 },
    bottomComponent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
});

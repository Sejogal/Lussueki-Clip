import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { FavoritesProvider } from '@/contexts/FavoritesContext';

export const unstable_settings = {
  anchor: 'index',
};

// O LK-CLIP é um app de streaming com UI escura em todas as telas (Home,
// categorias, player). Por isso fixamos o tema escuro do react-navigation
// independente do tema do sistema — assim a status bar, headers nativos e
// transições ficam consistentes com o resto do app, em vez de alternar
// pra um tema claro se o usuário tiver o celular no modo claro.
export default function RootLayout() {
  return (
    <FavoritesProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="iptv"
            options={{
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="player"
            options={{
              // Abre o player "por cima" da Home, como um modal cheio de
              // tela — reforça a sensação de "entrar" no conteúdo, e volta
              // suavemente pra Home ao sair.
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </FavoritesProvider>
  );
}
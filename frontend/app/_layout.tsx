import { AuthProvider } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        {/* O ecrã /player decide a própria orientação (ver app/player.tsx):
            retrato enquanto escolhe episódio, paisagem só a reproduzir. */}
        <Stack screenOptions={{ headerShown: false }} />
      </FavoritesProvider>
    </AuthProvider>
  );
}
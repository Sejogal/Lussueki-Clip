import { AuthProvider } from '@/contexts/AuthContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <AuthProvider>
      <FavoritesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </FavoritesProvider>
    </AuthProvider>
  );
}
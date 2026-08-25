// app/iptv/_layout.tsx
import { Stack } from 'expo-router';

// Layout próprio da seção de TV ao vivo — rota real "/iptv" (não um
// grupo entre parênteses, que não muda a URL e colidiria com a Home).
export default function IptvLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
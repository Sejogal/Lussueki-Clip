import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function AppBrand() {
  return (
    <View accessible accessibilityLabel="Lussueki Clip" style={styles.brand}>
      <Text allowFontScaling={false} numberOfLines={1} style={styles.word}>Lussueki</Text>
      <Text allowFontScaling={false} numberOfLines={1} style={styles.accent}>Clip</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'baseline', flexShrink: 0 },
  word: { color: '#fff', fontSize: 24, fontWeight: '800', includeFontPadding: false },
  accent: { color: '#e50914', fontSize: 24, fontWeight: '800', includeFontPadding: false, marginLeft: 5 },
});

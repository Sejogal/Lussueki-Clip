import React from 'react';
import { StyleSheet, Text } from 'react-native';

export default function AppBrand() {
  return <Text style={styles.brand} accessibilityLabel="Lussueki Clip">Lussueki <Text style={styles.accent}>Clip</Text></Text>;
}

const styles = StyleSheet.create({
  brand: { color: '#fff', fontSize: 24, fontWeight: '800' },
  accent: { color: 'red' },
});


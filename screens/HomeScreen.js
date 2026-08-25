import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { fetchContents } from '../services/api';
import { API_BASE_URL } from '../config';

export default function HomeScreen({ navigation }) {
  const [contents, setContents] = useState([]);

  useEffect(() => {
    loadContents();
  }, []);

  const loadContents = async () => {
    const data = await fetchContents();
    setContents(data);
  };

  const handleItemPress = (item) => {
    // Monta a URL completa do arquivo .m3u (ex: baseUrl + "/streams/" + nome)
    const streamUrl = `${API_BASE_URL}/streams/${item}`; // ajuste o caminho
    navigation.navigate('Player', { streamUrl, title: item });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => handleItemPress(item)}>
      <Text style={styles.title}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={contents}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  item: { padding: 15, borderBottomWidth: 1, borderColor: '#ccc' },
  title: { fontSize: 16 },
});
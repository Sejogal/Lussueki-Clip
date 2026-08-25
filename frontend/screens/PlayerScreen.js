import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import Video from 'react-native-video';

const { width, height } = Dimensions.get('window');

export default function PlayerScreen({ route, navigation }) {
  const { streamUrl, title } = route.params;
  const videoRef = useRef(null);

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}   // URL do .m3u (HLS ou MPEG-TS)
        style={styles.video}
        controls={true}               // exibe controles nativos
        resizeMode="contain"
        paused={false}
        onError={(e) => console.log('Erro no vídeo:', e)}
      />
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { width, height: height * 0.6, alignSelf: 'center' }, // ocupa 60% da tela
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  },
  backText: { color: '#fff', fontSize: 16 },
});
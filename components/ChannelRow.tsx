// components/ChannelRow.tsx
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IptvCategory, IptvChannel } from '@/utils/iptv';
// import FavoriteButton from '@/components/ui/FavoriteButton';

type Props = {
  category: IptvCategory;
};

const LOGO_SIZE = 84;

// Item memoizado — mesmo padrão de performance das outras listas do app.
type ChannelItemProps = {
  channel: IptvChannel;
  onPress: (channel: IptvChannel) => void;
};

const ChannelItem = React.memo(function ChannelItem({ channel, onPress }: ChannelItemProps) {
  return (
    <TouchableOpacity activeOpacity={0.75} style={styles.channelCard} onPress={() => onPress(channel)}>
      <View style={styles.logoWrapper}>
        {channel.posterUrl ? (
          <Image source={{ uri: channel.posterUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoFallbackText}>📺</Text>
          </View>
        )}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>AO VIVO</Text>
        </View>
        {/* <FavoriteButton
          item={{ title: channel.title, url: channel.url, posterUrl: channel.posterUrl, categoryKey: `iptv:${channel.group}` }}
          variant="overlay"
        /> */}
      </View>
      <Text style={styles.channelTitle} numberOfLines={2}>
        {channel.title}
      </Text>
    </TouchableOpacity>
  );
});

function ChannelRow({ category }: Props) {
  const router = useRouter();

  const handlePress = useCallback(
    (channel: IptvChannel) => {
      router.push({
        pathname: '/player',
        params: {
          streamUrl: channel.url,
          title: channel.title,
          posterUrl: channel.posterUrl ?? '',
          categoryKey: `iptv:${channel.group}`,
        },
      });
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: IptvChannel }) => <ChannelItem channel={item} onPress={handlePress} />,
    [handlePress]
  );

  const keyExtractor = useCallback((item: IptvChannel, index: number) => `${category.group}-${index}-${item.url}`, [
    category.group,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{category.group}</Text>
        <Text style={styles.headerCount}>{category.channels.length}</Text>
      </View>

      <FlatList
        data={category.channels}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: LOGO_SIZE + 12,
          offset: (LOGO_SIZE + 12) * index,
          index,
        })}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

export default React.memo(ChannelRow);

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerCount: {
    color: '#8e8e93',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  channelCard: {
    width: LOGO_SIZE,
    marginRight: 12,
  },
  logoWrapper: {
    position: 'relative',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 8,
    backgroundColor: '#1c1c1e',
  },
  logoFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoFallbackText: {
    fontSize: 28,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#e50914',
  },
  liveText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  channelTitle: {
    color: '#d1d1d6',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 14,
    textAlign: 'center',
  },
});
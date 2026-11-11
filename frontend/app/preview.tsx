// app/preview.tsx
//
// Tela aberta ao tocar num conteúdo VOD (séries, filmes, domínio público,
// favoritos, busca) antes de ir para o player. TV ao vivo e itens que já
// estão "em andamento" (continuar assistindo, downloads já feitos) pulam
// esta tela e vão direto ao player — não faz sentido interromper quem já
// escolheu, mesma razão que já pula o botão de download.
//
// Resolve a playlist aqui mesmo (mesma lógica recursiva do player: uma
// categoria pode apontar pra uma lista de temporadas, que aponta pra uma
// lista de episódios, etc.) só para decidir o que mostrar:
// - Resolve para UM item só (filme): capa grande + botão "Assistir".
// - Resolve para uma LISTA (temporadas/episódios): a capa encolhe e fica
//   por cima da lista, na mesma tela — nunca duas capas em sequência.
// Tocar num episódio da lista vai direto pro player (que resolve de novo,
// mas bate no cache do dispositivo, então é instantâneo).
//
// Não há sinopse disponível: as fontes atuais (archive.org, paste.php) só
// dão título, pôster e URL — por isso o preview foca no que existe de
// verdade (capa em alta resolução + categoria) em vez de inventar texto.
import FavoriteButton from '@/components/FavoriteButton';
import { ARCHIVE_ITEM_PREFIX, getArchiveOrgPlayableUrl } from '@/services/archiveOrg';
import { getCategoryDisplay } from '@/utils/categoryDisplay';
import { fetchPlaylistEntries, isDirectMediaUrl, PlaylistEntry } from '@/utils/playlist';
import { getHiResImage } from '@/utils/tmdb';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ListLevel = { title: string; entries: PlaylistEntry[] };

function paramToString(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] ?? '' : value;
}

function friendlyResolveError(err: unknown): string {
  const message = String(err instanceof Error ? err.message : err);
  if (/network request failed|failed to fetch|networkerror|timeout/i.test(message)) {
    return 'Não foi possível conectar à fonte deste conteúdo. Verifique sua conexão e tente novamente.';
  }
  return 'Não foi possível abrir este conteúdo. O link pode estar indisponível.';
}

const EpisodeItem = React.memo(function EpisodeItem({
  item,
  index,
  onPress,
}: {
  item: PlaylistEntry;
  index: number;
  onPress: (item: PlaylistEntry) => void;
}) {
  return (
    <TouchableOpacity focusable style={styles.episodeItem} onPress={() => onPress(item)}>
      {item.posterUrl ? (
        <Image source={{ uri: item.posterUrl }} style={styles.episodeThumb} />
      ) : (
        <View style={styles.episodeIndexBadge}>
          <Text style={styles.episodeIndexText}>{index + 1}</Text>
        </View>
      )}
      <Text style={styles.episodeItemText} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
});

export default function PreviewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const streamUrl = paramToString(params.streamUrl);
  const title = paramToString(params.title) || 'Sem título';
  const posterUrl = paramToString(params.posterUrl) || undefined;
  const categoryKey = paramToString(params.categoryKey);
  // Só algumas fontes (hoje: busca do archive.org) fornecem sinopse de
  // verdade — quando não vier nada, o parágrafo simplesmente não aparece.
  const synopsis = paramToString(params.synopsis) || undefined;

  const categoryDisplay = useMemo(() => getCategoryDisplay(categoryKey || undefined), [categoryKey]);
  const backdropUrl = useMemo(() => getHiResImage(posterUrl, 'w780'), [posterUrl]);

  // ── Resolução recursiva (mesma ideia do player.tsx) ──────────────────
  const [coverResolving, setCoverResolving] = useState(true);
  const [levelLoading, setLevelLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [currentList, setCurrentList] = useState<ListLevel | null>(null);
  const [listStack, setListStack] = useState<ListLevel[]>([]);
  const [resolvedLeaf, setResolvedLeaf] = useState<{ title: string; url: string } | null>(null);

  const currentListRef = useRef<ListLevel | null>(null);
  useEffect(() => {
    currentListRef.current = currentList;
  }, [currentList]);

  const resolveTokenRef = useRef(0);

  const goToPlayer = useCallback(
    (entryTitle: string, entryUrl: string) => {
      router.push({
        pathname: '/player',
        params: { streamUrl: entryUrl, title: entryTitle, posterUrl: posterUrl ?? '', categoryKey },
      });
    },
    [router, posterUrl, categoryKey]
  );

  const resolveLevel = useCallback(
    async (url: string, label: string, pushToStack: boolean, initial: boolean) => {
      const token = ++resolveTokenRef.current;
      if (initial) setCoverResolving(true);
      else setLevelLoading(true);
      setResolveError(null);

      try {
        if (url.startsWith(ARCHIVE_ITEM_PREFIX)) {
          const identifier = url.slice(ARCHIVE_ITEM_PREFIX.length);
          const resolved = await getArchiveOrgPlayableUrl(identifier);
          if (token !== resolveTokenRef.current) return;
          if (!resolved) throw new Error('Nenhum arquivo de vídeo compatível encontrado neste item.');
          await resolveLevel(resolved.url, resolved.title || label, pushToStack, initial);
          return;
        }

        if (url.startsWith('file://') || isDirectMediaUrl(url)) {
          if (token !== resolveTokenRef.current) return;
          if (initial) {
            setResolvedLeaf({ title: label, url });
            setCoverResolving(false);
          } else {
            goToPlayer(label, url);
          }
          return;
        }

        const entries = await fetchPlaylistEntries(url);
        if (token !== resolveTokenRef.current) return;

        if (entries.length === 0) throw new Error('Esta lista está vazia ou indisponível.');

        if (entries.length === 1) {
          await resolveLevel(entries[0].url, entries[0].title || label, pushToStack, initial);
          return;
        }

        if (pushToStack && currentListRef.current) {
          setListStack((stack) => [...stack, currentListRef.current!]);
        }
        setCurrentList({ title: label, entries });
        setResolvedLeaf(null);
        setCoverResolving(false);
        setLevelLoading(false);
      } catch (err) {
        if (token !== resolveTokenRef.current) return;
        setResolveError(friendlyResolveError(err));
        setCoverResolving(false);
        setLevelLoading(false);
      }
    },
    [goToPlayer]
  );

  useEffect(() => {
    if (!streamUrl) {
      setResolveError('Conteúdo não encontrado.');
      setCoverResolving(false);
      return;
    }
    void resolveLevel(streamUrl, title, false, true);
    // Só na primeira montagem desta tela — streamUrl/title não mudam depois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  const handleEntryPress = useCallback(
    (entry: PlaylistEntry) => {
      void resolveLevel(entry.url, entry.title, true, false);
    },
    [resolveLevel]
  );

  // Só existe botão para isto quando NÃO há lista (ver render abaixo) —
  // uma série sempre resolve pro ecrã de episódios, nunca pra este botão.
  const handleAssistir = useCallback(() => {
    if (resolvedLeaf) goToPlayer(resolvedLeaf.title, resolvedLeaf.url);
  }, [resolvedLeaf, goToPlayer]);

  const handleBack = () => {
    if (listStack.length > 0) {
      const previous = listStack[listStack.length - 1];
      setListStack((stack) => stack.slice(0, -1));
      setCurrentList(previous);
      return;
    }
    router.back();
  };

  const renderEpisodeItem = useCallback(
    ({ item, index }: { item: PlaylistEntry; index: number }) => (
      <EpisodeItem item={item} index={index} onPress={handleEntryPress} />
    ),
    [handleEntryPress]
  );
  const episodeKeyExtractor = useCallback((item: PlaylistEntry, index: number) => `${index}-${item.url}`, []);

  const showingList = currentList !== null;
  const assistirDisabled = coverResolving || !resolvedLeaf;
  const assistirLabel = coverResolving ? 'A carregar...' : 'Assistir';

  return (
    <View style={styles.container}>
      <View style={showingList ? styles.compactCoverWrap : styles.heroCoverWrap}>
        {backdropUrl ? (
          <Image source={{ uri: backdropUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.backdropFallback]}>
            <Ionicons name="film-outline" size={showingList ? 44 : 64} color="#3a3a3e" />
          </View>
        )}
        <LinearGradient
          colors={
            showingList
              ? ['transparent', 'rgba(0,0,0,0.4)', '#09090b']
              : ['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.5)', '#09090b']
          }
          locations={showingList ? [0, 0.48, 1] : [0, 0.28, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />

        {!showingList && (
          <View style={styles.content}>
            {categoryDisplay.label ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {categoryDisplay.icon} {categoryDisplay.label.toUpperCase()}
                </Text>
              </View>
            ) : null}
            <View style={styles.titlePanel}>
              <Text style={styles.title} numberOfLines={3}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.playButton, assistirDisabled && styles.playButtonDisabled]}
              disabled={assistirDisabled}
              onPress={handleAssistir}
            >
              {!coverResolving && <Ionicons name="play" size={20} color="#000" />}
              <Text style={styles.playButtonText}>{assistirLabel}</Text>
            </TouchableOpacity>
          </View>
        )}

        {showingList && (
          <View style={styles.compactContent}>
            <Text style={styles.compactEyebrow} numberOfLines={1}>
              {listStack.length > 0 ? `EPISÓDIOS · ${currentList!.title}` : 'ESCOLHA UMA TEMPORADA'}
            </Text>
            <View style={styles.compactTitlePanel}>
              <Text style={styles.compactTitle} numberOfLines={2}>
                {title}
              </Text>
            </View>
          </View>
        )}
      </View>

      {!showingList && !resolveError && synopsis && (
        <ScrollView contentContainerStyle={styles.synopsisContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.synopsisText}>{synopsis}</Text>
        </ScrollView>
      )}

      <View style={styles.topRow}>
        <TouchableOpacity focusable accessibilityLabel="Voltar" style={styles.roundButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={21} color="#fff" />
        </TouchableOpacity>
        <FavoriteButton item={{ title, url: streamUrl, posterUrl, categoryKey }} variant="floating" size={20} />
      </View>

      {resolveError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{resolveError}</Text>
          <View style={styles.errorButtonRow}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => void resolveLevel(streamUrl, title, false, true)}
            >
              <Text style={styles.playButtonText}>↻ Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showingList && !resolveError && (
        <>
          {levelLoading && (
            <View style={styles.inlineResolving}>
              <Text style={styles.inlineResolvingText}>Lendo playlist...</Text>
            </View>
          )}
          <FlatList
            data={currentList!.entries}
            keyExtractor={episodeKeyExtractor}
            contentContainerStyle={styles.episodeList}
            renderItem={renderEpisodeItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews
          />
        </>
      )}
    </View>
  );
}

const HERO_HEIGHT = SCREEN_HEIGHT * 0.62;
const COMPACT_HEIGHT = SCREEN_HEIGHT * 0.32;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  heroCoverWrap: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  compactCoverWrap: { width: SCREEN_WIDTH, height: COMPACT_HEIGHT },
  backdropFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#161618' },
  topRow: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(229,9,20,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    marginBottom: 14,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  titlePanel: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderLeftWidth: 4,
    borderLeftColor: '#e50914',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  playButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 6,
  },
  playButtonDisabled: { opacity: 0.6 },
  playButtonText: { color: '#000', fontSize: 15, fontWeight: '800' },
  synopsisContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30 },
  synopsisText: { color: '#c7c7cc', fontSize: 13.5, lineHeight: 20 },
  compactContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 16,
  },
  compactEyebrow: { color: '#ff777d', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  compactTitlePanel: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderLeftWidth: 4,
    borderLeftColor: '#e50914',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  compactTitle: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  inlineResolving: { paddingHorizontal: 16, paddingVertical: 8 },
  inlineResolvingText: { color: '#8e8e93', fontSize: 12 },
  episodeList: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
  episodeItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  episodeThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#1c1c1e' },
  episodeIndexBadge: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  episodeIndexText: { color: '#8e8e93', fontSize: 16, fontWeight: '700' },
  episodeItemText: { flex: 1, color: '#e5e5e7', fontSize: 14, fontWeight: '600' },
  errorBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#e5e5e7', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  errorButtonRow: { marginTop: 16 },
  retryButton: { backgroundColor: '#d91620', borderRadius: 7, paddingHorizontal: 18, paddingVertical: 11 },
});

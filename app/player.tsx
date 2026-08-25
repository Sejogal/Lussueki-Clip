// app/player.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { ARCHIVE_ITEM_PREFIX, getArchiveOrgPlayableUrl } from '@/services/archiveOrg';
import { fetchPlaylistEntries, isDirectMediaUrl, PlaylistEntry } from '@/utils/playlist';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';

type Episode = PlaylistEntry;

type ListLevel = {
  title: string;
  entries: Episode[];
};

// ── Item da lista de episódios, extraído como componente memoizado ────
// Categorias com muitos episódios (às vezes 20-50+) são exatamente o
// cenário que dispara o aviso "large list that is slow to update" do
// VirtualizedList quando o renderItem é uma função inline — React.memo
// aqui garante que só o item tocado realmente re-renderiza.
type EpisodeItemProps = {
  item: Episode;
  index: number;
  onPress: (item: Episode) => void;
};

const EpisodeItem = React.memo(function EpisodeItem({ item, index, onPress }: EpisodeItemProps) {
  return (
    <TouchableOpacity style={styles.episodeItem} onPress={() => onPress(item)}>
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

// Códigos HTTP que geralmente são transitórios (servidor sobrecarregado,
// manutenção, rate limiting) — vale a pena tentar de novo automaticamente.
const RETRYABLE_HTTP_CODES = ['502', '503', '504'];

// Erros de REDE (não código HTTP — a conexão nem chegou a receber uma
// resposta) que também costumam ser transitórios: timeout, conexão
// recusada momentaneamente, etc. Reconhecidos pelo nome da exceção do
// Android/ExoPlayer que aparece na mensagem.
const RETRYABLE_NETWORK_PATTERNS = [
  /sockettimeoutexception/i,
  /connecttimeoutexception/i,
  /\btimeout\b/i,
  /connectexception/i,
  /connection reset/i,
];

function getHttpCodeFromError(message: string): string | null {
  const match = message.match(/response code:\s*(\d{3})/i);
  return match ? match[1] : null;
}

function isTimeoutOrNetworkError(message: string): boolean {
  return RETRYABLE_NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

function isRetryableError(message: string): boolean {
  const code = getHttpCodeFromError(message);
  if (code !== null) return RETRYABLE_HTTP_CODES.includes(code);
  return isTimeoutOrNetworkError(message);
}

function getFriendlyErrorMessage(message: string): string {
  const code = getHttpCodeFromError(message);
  if (code === '503') {
    return 'O servidor do vídeo está indisponível no momento (erro 503) — geralmente é temporário.';
  }
  if (code === '502' || code === '504') {
    return `O servidor do vídeo demorou demais pra responder (erro ${code}) — geralmente é temporário.`;
  }
  if (code === '404') {
    return 'Este vídeo não foi encontrado no servidor (erro 404) — o link pode ter sido removido.';
  }
  if (code) {
    return `O servidor do vídeo recusou a conexão (erro ${code}).`;
  }
  if (isTimeoutOrNetworkError(message)) {
    return 'A conexão com o servidor do vídeo demorou demais e expirou (timeout) — geralmente é temporário, pode ser uma rede lenta ou o servidor sobrecarregado.';
  }
  return message;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams();

  // Trata parâmetros que podem vir como array ou string
  const streamUrl = useMemo(() => {
    if (!params.streamUrl) return null;
    if (Array.isArray(params.streamUrl)) {
      return params.streamUrl[0] || null;
    }
    return String(params.streamUrl) || null;
  }, [params.streamUrl]);

  const paramTitle = useMemo(() => {
    if (!params.title) return null;
    if (Array.isArray(params.title)) {
      return params.title[0] || null;
    }
    return String(params.title);
  }, [params.title]);

  // posterUrl/categoryKey são opcionais — só existem quando a navegação
  // veio da Home (CategoryRow, Hero, Minha Lista), usados aqui só pra
  // conseguir favoritar o título com os mesmos dados exibidos lá.
  const paramPosterUrl = useMemo(() => {
    if (!params.posterUrl) return undefined;
    const value = Array.isArray(params.posterUrl) ? params.posterUrl[0] : params.posterUrl;
    return value ? String(value) : undefined;
  }, [params.posterUrl]);

  const paramCategoryKey = useMemo(() => {
    if (!params.categoryKey) return undefined;
    const value = Array.isArray(params.categoryKey) ? params.categoryKey[0] : params.categoryKey;
    return value ? String(value) : undefined;
  }, [params.categoryKey]);

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<VideoPlayer | null>(null);

  // ── Resolução recursiva de playlists ─────────────────────────────────
  // A hierarquia aqui pode ter MAIS DE UM NÍVEL: uma categoria aponta pra
  // uma lista de títulos, cada título pode apontar pra uma lista de
  // episódios, e cada episódio pode (raramente, mas acontece) apontar pra
  // outra lista ainda. Por isso resolvemos recursivamente: sempre que
  // teríamos uma "mídia final", checamos se ela não é, na verdade, mais
  // uma playlist — e se for, resolvemos de novo, até achar vídeo de
  // verdade ou uma lista com mais de um item (aí mostramos o seletor).
  const [currentList, setCurrentList] = useState<ListLevel | null>(null);
  const [listStack, setListStack] = useState<ListLevel[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);

  const currentListRef = useRef<ListLevel | null>(null);
  useEffect(() => {
    currentListRef.current = currentList;
  }, [currentList]);

  // Token de cancelamento: toda vez que uma nova resolução começa, o
  // token muda — se uma resolução antiga (assíncrona, em voo) terminar
  // depois de uma mais nova ter começado, ela se auto-cancela em vez de
  // sobrescrever o estado com informação desatualizada.
  const resolveTokenRef = useRef(0);

  const resolveSource = useCallback(async (url: string, label: string, pushCurrentToStack: boolean) => {
    const token = ++resolveTokenRef.current;
    setResolving(true);
    setError(null);

    try {
      // Item do archive.org "pendente de resolução" (marcado pelo prefixo
      // especial): busca os metadados reais só agora, na hora de tocar,
      // e escolhe o melhor arquivo de vídeo disponível.
      if (url.startsWith(ARCHIVE_ITEM_PREFIX)) {
        const identifier = url.slice(ARCHIVE_ITEM_PREFIX.length);
        const resolved = await getArchiveOrgPlayableUrl(identifier);
        if (token !== resolveTokenRef.current) return;

        if (!resolved) {
          throw new Error('Nenhum arquivo de vídeo compatível encontrado neste item do archive.org');
        }

        await resolveSource(resolved.url, resolved.title || label, pushCurrentToStack);
        return;
      }

      if (isDirectMediaUrl(url)) {
        if (token !== resolveTokenRef.current) return;
        setSelectedEpisode({ title: label, url });
        setResolving(false);
        return;
      }

      const entries = await fetchPlaylistEntries(url);
      if (token !== resolveTokenRef.current) return;

      if (entries.length === 0) {
        throw new Error('A playlist está vazia ou não contém URLs de mídia');
      }

      console.log(`📃 Playlist resolvida (${label}): ${entries.length} item(ns)`);

      if (entries.length === 1) {
        // Só um item: não vale a pena mostrar uma lista de 1 elemento —
        // resolve direto o próximo nível (que pode ser mídia final ou
        // ainda outra lista).
        await resolveSource(entries[0].url, entries[0].title || label, pushCurrentToStack);
        return;
      }

      // Vários itens: mostra o seletor. Se estamos navegando mais fundo
      // (usuário tocou em um item de uma lista anterior), empilha a
      // lista atual pra o botão "Voltar" conseguir subir um nível.
      if (pushCurrentToStack && currentListRef.current) {
        setListStack((stack) => [...stack, currentListRef.current!]);
      }
      setCurrentList({ title: label, entries });
      setSelectedEpisode(null);
      setLoading(false);
      setResolving(false);
    } catch (err) {
      if (token !== resolveTokenRef.current) return;
      console.error('❌ Erro ao resolver playlist:', err);
      setError('Erro ao ler a playlist: ' + String(err));
      setLoading(false);
      setResolving(false);
    }
  }, []);

  // Dispara a resolução inicial quando a tela recebe a URL.
  useEffect(() => {
    if (!streamUrl) return;
    resolveSource(streamUrl, paramTitle || 'Reproduzindo...', false);
  }, [streamUrl]);

  // Fonte de vídeo usada pelo player. Muitos servidores de IPTV/Xtream
  // exigem um User-Agent reconhecido (o VLC manda o dele por padrão) —
  // sem isso, a conexão pode até abrir mas o vídeo nunca começa a bufferizar.
  const videoSource = useMemo(() => {
    if (!selectedEpisode) return '';
    return {
      uri: selectedEpisode.url,
      headers: { 'User-Agent': USER_AGENT },
    };
  }, [selectedEpisode]);

  // IMPORTANTE: useVideoPlayer é um Hook do React e precisa ser chamado
  // incondicionalmente, sempre na mesma ordem, no nível superior do
  // componente — nunca dentro de useMemo, if, try/catch, etc. Aqui ele é
  // criado uma única vez; quando o usuário troca de episódio, usamos
  // player.replaceAsync() (efeito abaixo) em vez de recriar o player.
  const player = useVideoPlayer('', (playerInstance) => {
    playerRef.current = playerInstance;
  });

  // Validação de URL ausente, feita como efeito (não durante o render)
  useEffect(() => {
    if (!streamUrl) {
      console.error('❌ StreamUrl não fornecida');
      setError('URL do stream não fornecida');
      setLoading(false);
    }
  }, [streamUrl]);

  // Guarda a seleção atual em uma ref para o listener de status conseguir
  // checar o valor mais recente sem precisar recriar a subscription toda
  // vez que o episódio muda.
  const selectedEpisodeRef = useRef<Episode | null>(null);
  useEffect(() => {
    selectedEpisodeRef.current = selectedEpisode;
  }, [selectedEpisode]);

  // Ref para a função de retry poder ser chamada de dentro do listener de
  // status (definido antes de attemptPlayback existir) sem closures obsoletas.
  const attemptPlaybackRef = useRef<((episode: Episode) => Promise<void>) | null>(null);

  // Ouve o status REAL do player, em vez de confiar só na Promise do play().
  // A Promise pode resolver mesmo que o vídeo nunca comece a bufferizar de
  // fato — por isso o loading ficava preso pra sempre sem nenhum erro.
  useEffect(() => {
    if (!player) return;

    const subscription = player.addListener('statusChange', ({ status, error: statusError }) => {
      // O player é criado com uma fonte vazia antes de qualquer episódio
      // ser escolhido (necessário porque o Hook não pode ser condicional).
      // Isso dispara um "error" espúrio (ENOENT) que não tem relação com
      // o stream de verdade — ignoramos até haver um episódio selecionado.
      if (!selectedEpisodeRef.current) {
        console.log('📡 Status do player (ignorado, sem episódio selecionado ainda):', status);
        return;
      }

      console.log('📡 Status do player:', status, statusError ?? '');

      if (status === 'readyToPlay') {
        setLoading(false);
        setError(null);
        retryCountRef.current = 0;
      } else if (status === 'error') {
        const rawMessage = statusError?.message ?? 'formato não suportado ou servidor recusou a conexão';

        // Servidores pequenos/instáveis como esses costumam precisar de
        // mais de uma tentativa — 2 tentativas com backoff progressivo
        // (1.5s, depois 3.5s) tanto pra erros HTTP (5xx) quanto timeout.
        const maxRetries = 2;

        if (isRetryableError(rawMessage) && retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          const delay = retryCountRef.current === 1 ? 1500 : 3500;
          console.log(`🔁 Erro transitório detectado (tentativa ${retryCountRef.current}/${maxRetries}), tentando novamente em ${delay}ms...`);
          setTimeout(() => {
            const episode = selectedEpisodeRef.current;
            if (episode) attemptPlaybackRef.current?.(episode);
          }, delay);
          return;
        }

        setLoading(false);
        setError('Erro ao carregar o stream: ' + getFriendlyErrorMessage(rawMessage));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Contador de tentativas automáticas para erros transitórios do
  // servidor (5xx) — reseta toda vez que um episódio novo é selecionado.
  const retryCountRef = useRef(0);

  // Função reutilizável de "tentar tocar este episódio agora", usada
  // tanto pela troca normal de fonte quanto pelo retry automático/manual.
  const attemptPlayback = async (episode: Episode) => {
    setLoading(true);
    setError(null);
    try {
      console.log('▶️ Trocando fonte e iniciando reprodução:', episode.url);
      await player.replaceAsync({
        uri: episode.url,
        headers: { 'User-Agent': USER_AGENT },
      });
      await player.play();
      // Não zeramos loading/error aqui: quem faz isso é o listener de
      // statusChange abaixo, que reflete o estado real do player.
    } catch (err) {
      console.error('❌ Erro ao reproduzir:', err);
      setError('Erro ao reproduzir: ' + String(err));
      setLoading(false);
    }
  };
  attemptPlaybackRef.current = attemptPlayback;

  // Retry manual: reseta o contador (pra permitir novo auto-retry também)
  // e tenta tocar o episódio atual de novo do zero.
  const handleManualRetry = () => {
    if (!selectedEpisode) return;
    retryCountRef.current = 0;
    attemptPlayback(selectedEpisode);
  };

  // Troca a fonte do player sempre que o episódio selecionado mudar
  // (seja a escolha inicial ou uma troca manual pelo seletor).
  useEffect(() => {
    if (!player || !selectedEpisode) return;
    retryCountRef.current = 0;

    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await attemptPlayback(selectedEpisode);
    })();

    return () => {
      cancelled = true;
    };
  }, [player, selectedEpisode]);

  // Timeout de segurança: se depois de 20s o status nunca mudou (nem
  // readyToPlay nem error), avisamos o usuário em vez de deixar o loading
  // girando pra sempre — geralmente indica que o servidor aceitou a conexão
  // mas está entregando um formato/stream que o player não consegue decodificar.
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!selectedEpisode) return;
    const timeout = setTimeout(() => {
      if (loadingRef.current) {
        setError(
          'O stream não respondeu a tempo. O formato pode não ser compatível (ex: TS bruto em vez de HLS/m3u8), ou o servidor pode estar bloqueando a conexão.'
        );
        setLoading(false);
      }
    }, 20000);
    return () => clearTimeout(timeout);
  }, [selectedEpisode]);

  const handleEpisodePress = useCallback(
    (item: Episode) => {
      resolveSource(item.url, item.title, true);
    },
    [resolveSource]
  );

  const renderEpisodeItem = useCallback(
    ({ item, index }: { item: Episode; index: number }) => (
      <EpisodeItem item={item} index={index} onPress={handleEpisodePress} />
    ),
    [handleEpisodePress]
  );

  const episodeKeyExtractor = useCallback((item: Episode, index: number) => `${index}-${item.url}`, []);

  const handleBack = () => {
    if (listStack.length > 0) {
      // Sobe um nível na hierarquia em vez de sair do player.
      const previous = listStack[listStack.length - 1];
      setListStack((stack) => stack.slice(0, -1));
      setCurrentList(previous);
      setSelectedEpisode(null);
      return;
    }
    try {
      player.pause();
    } catch {}
    router.back();
  };

  if (!streamUrl) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>⚠️ URL do stream não encontrada</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <View style={styles.errorButtonRow}>
            {selectedEpisode && (
              <TouchableOpacity style={styles.retryButton} onPress={handleManualRetry}>
                <Text style={styles.backText}>↻ Tentar novamente</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.backButtonInline} onPress={() => router.back()}>
              <Text style={styles.backText}>← Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Tela de seleção (lista do nível atual) ───────────────────────────
  // Aparece sempre que a resolução parar numa lista com mais de um item
  // e nenhuma mídia final tiver sido escolhida ainda.
  if (currentList && !selectedEpisode) {
    return (
      <View style={styles.container}>
        <View style={styles.episodeHeader}>
          <TouchableOpacity style={styles.backButtonInline} onPress={handleBack}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.episodeHeaderTitle} numberOfLines={1}>
            {currentList.title}
          </Text>
          {streamUrl && (
            <FavoriteButton
              item={{
                title: paramTitle || currentList.title,
                url: streamUrl,
                posterUrl: paramPosterUrl,
                categoryKey: paramCategoryKey,
              }}
              variant="floating"
            />
          )}
        </View>
        {resolving && (
          <View style={styles.inlineResolving}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.inlineResolvingText}>Lendo playlist...</Text>
          </View>
        )}
        <FlatList
          data={currentList.entries}
          keyExtractor={episodeKeyExtractor}
          contentContainerStyle={styles.episodeList}
          renderItem={renderEpisodeItem}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>
            {resolving ? 'Lendo playlist...' : 'Carregando vídeo...'}
          </Text>
        </View>
      )}
      {selectedEpisode && (
        <VideoView
          style={styles.video}
          player={player}
          contentFit="contain"
          nativeControls={true}
        />
      )}
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>
      <View style={styles.topRightStack}>
        {streamUrl && (
          <FavoriteButton
            item={{
              title: paramTitle || 'Reproduzindo...',
              url: streamUrl,
              posterUrl: paramPosterUrl,
              categoryKey: paramCategoryKey,
            }}
            variant="floating"
          />
        )}
        {currentList && (
          <TouchableOpacity
            style={styles.episodesButton}
            onPress={() => {
              try {
                player.pause();
              } catch {}
              setSelectedEpisode(null);
            }}
          >
            <Text style={styles.backText}>☰ Episódios</Text>
          </TouchableOpacity>
        )}
      </View>
      {(selectedEpisode?.title || paramTitle) && (
        <View style={styles.titleContainer}>
          <Text style={styles.titleText} numberOfLines={2}>
            {selectedEpisode?.title || paramTitle}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: { width, height: height * 0.85, alignSelf: 'center' },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    zIndex: 10,
  },
  backButtonInline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  errorButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  retryButton: {
    backgroundColor: 'rgba(229,9,20,0.85)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  episodesButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  topRightStack: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  backText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 5,
  },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 14 },
  errorText: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', marginBottom: 20 },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
  },
  titleText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  episodeHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  inlineResolving: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  inlineResolvingText: {
    color: '#8e8e93',
    fontSize: 13,
  },
  episodeList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  episodeIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  episodeIndexText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  episodeThumb: {
    width: 46,
    height: 66,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 12,
  },
  episodeItemText: { color: '#fff', fontSize: 15, flex: 1 },
});
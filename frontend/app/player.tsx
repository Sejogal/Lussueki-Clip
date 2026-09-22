// app/player.tsx
import FavoriteButton from '@/components/FavoriteButton';
import { useAuth } from '@/contexts/AuthContext';
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
import styles from '../assets/styles/player';

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

// Janela de retentativa automática do player: ao encontrar QUALQUER erro na
// hora de carregar/reproduzir o stream (incluindo bloqueios momentâneos como
// 403/CLEARTEXT ou timeouts), tentamos de novo sozinhos por cerca de 1
// minuto, com backoff progressivo, antes de finalmente mostrar a tela de
// erro pro usuário. A ideia é que instabilidades passageiras de rede/CDN se
// resolvam sozinhas sem o usuário nem perceber que algo falhou.
const RETRY_DELAYS_MS = [2000, 3000, 5000, 8000, 12000, 15000, 15000]; // soma ≈ 60s

function getHttpCodeFromError(message: string): string | null {
  const match = message.match(/response code:\s*(\d{3})/i);
  return match ? match[1] : null;
}

function isTimeoutOrNetworkError(message: string): boolean {
  return RETRYABLE_NETWORK_PATTERNS.some((pattern) => pattern.test(message));
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

function getContentKey(sourceUrl: string, title: string): string {
  let hash = 2166136261;
  const value = `${sourceUrl}\u0000${title}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `watch-${(hash >>> 0).toString(16)}`;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams();
  const { recordWatch } = useAuth();

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

  const resumePosition = useMemo(() => {
    if (!params.positionSeconds) return 0;
    const value = Array.isArray(params.positionSeconds) ? params.positionSeconds[0] : params.positionSeconds;
    const position = Number(value);
    return Number.isFinite(position) && position > 0 ? position : 0;
  }, [params.positionSeconds]);

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Número da tentativa de retry em andamento (0 = nenhuma). Só usado pra
  // mostrar um texto discreto de "Reconectando..." na tela de loading em
  // vez de pular direto pra tela de erro.
  const [retryAttempt, setRetryAttempt] = useState(0);
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

  // "Continuar assistindo" só nos dá a URL da playlist do título (não a
  // do episódio específico) mais o título do episódio e a posição salvos
  // no histórico. Quando essa playlist resolve pra mais de um item,
  // tentamos casar o título salvo com um dos itens — uma única vez — pra
  // pular direto pro episódio certo em vez de parar no seletor. Fica
  // "armado" só quando chegamos aqui com uma posição salva (resumePosition
  // > 0), que é o sinal de que viemos do histórico.
  const pendingResumeMatchRef = useRef(resumePosition > 0);

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

      // Veio de "Continuar assistindo" (resumePosition > 0) e ainda não
      // tentamos casar o episódio salvo com esta lista? Procura pelo
      // título exato antes de cair no seletor manual.
      if (pendingResumeMatchRef.current) {
        pendingResumeMatchRef.current = false; // só tenta uma vez
        const normalizedTarget = (paramTitle || '').trim().toLowerCase();
        const match = normalizedTarget
          ? entries.find((entry) => (entry.title || '').trim().toLowerCase() === normalizedTarget)
          : undefined;
        if (match) {
          console.log(`⏩ Retomando episódio salvo: "${match.title}"`);
          await resolveSource(match.url, match.title || label, pushCurrentToStack);
          return;
        }
        console.log('⏩ Não foi possível casar o episódio salvo com nenhum item da lista, mostrando seletor.');
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
  }, [paramTitle]);

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
  const recordWatchRef = useRef(recordWatch);
  const watchedEpisodeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    selectedEpisodeRef.current = selectedEpisode;
  }, [selectedEpisode]);
  useEffect(() => {
    recordWatchRef.current = recordWatch;
  }, [recordWatch]);
  useEffect(() => {
    watchedEpisodeKeyRef.current = null;
  }, [selectedEpisode]);

  // Salva snapshots periódicos para que a retomada funcione em outro aparelho.
  // O primeiro registro, feito quando o player fica pronto, conta uma visualização;
  // os snapshots seguintes apenas atualizam a posição.
  // Guarda a última posição/duração lidas com sucesso. Necessário porque,
  // no unmount, o player nativo (useVideoPlayer) pode já ter sido liberado
  // ANTES deste efeito rodar seu cleanup — não há garantia de ordem entre
  // os cleanups de hooks diferentes. Ler player.currentTime nesse momento
  // lança "Cannot use shared object that was already released". Por isso
  // guardamos o último valor bom numa ref e, no cleanup, só tentamos uma
  // leitura fresca dentro de um try/catch, caindo pra ref se o player já
  // tiver sido destruído.
  const lastKnownProgressRef = useRef<{ position: number; duration?: number } | null>(null);

  useEffect(() => {
    if (!selectedEpisode || !streamUrl) return;

    const readProgress = (): { position: number; duration?: number } | null => {
      try {
        const position = Math.max(0, Math.floor(player.currentTime || 0));
        const duration = Number.isFinite(player.duration) && player.duration > 0
          ? Math.floor(player.duration)
          : undefined;
        const result = { position, duration };
        lastKnownProgressRef.current = result;
        return result;
      } catch (err) {
        // Player já liberado (ex.: durante unmount) — usa o último valor conhecido.
        console.warn('Player indisponível ao ler progresso, usando último valor conhecido:', err);
        return lastKnownProgressRef.current;
      }
    };

    const saveProgress = () => {
      const progress = readProgress();
      if (!progress || progress.position <= 0) return;
      void recordWatchRef.current({
        title: selectedEpisode.title || paramTitle || 'Reproduzindo...',
        category: paramCategoryKey,
        source_url: streamUrl,
        content_key: getContentKey(streamUrl, selectedEpisode.title),
        position_seconds: progress.position,
        duration_seconds: progress.duration,
        count_view: false,
      }).catch((error) => console.warn('Não foi possível salvar o progresso:', error));
    };

    const interval = setInterval(saveProgress, 15000);
    return () => {
      clearInterval(interval);
      saveProgress();
    };
  }, [paramCategoryKey, paramTitle, player, selectedEpisode, streamUrl]);

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
        clearWatchdog();
        setLoading(false);
        setError(null);
        retryCountRef.current = 0;
        setRetryAttempt(0);
        const episode = selectedEpisodeRef.current;
        if (episode && streamUrl) {
          const contentKey = getContentKey(streamUrl, episode.title);
          if (watchedEpisodeKeyRef.current !== contentKey) {
            watchedEpisodeKeyRef.current = contentKey;
            void recordWatchRef.current({
              title: episode.title || paramTitle || 'Reproduzindo...',
              category: paramCategoryKey,
              source_url: streamUrl,
              content_key: contentKey,
              position_seconds: 0,
              duration_seconds: undefined,
              count_view: true,
            }).catch((error) => console.warn('Não foi possível salvar o histórico:', error));
          }
        }
      } else if (status === 'error') {
        clearWatchdog();
        const rawMessage = statusError?.message ?? 'formato não suportado ou servidor recusou a conexão';
        const episode = selectedEpisodeRef.current;

        if (episode && scheduleRetry(episode)) {
          return;
        }

        setLoading(false);
        setError('Erro ao carregar o stream: ' + getFriendlyErrorMessage(rawMessage));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [paramCategoryKey, paramTitle, player, streamUrl]);

  // Contador de tentativas automáticas (qualquer tipo de erro de
  // reprodução) — reseta toda vez que um episódio novo é selecionado ou
  // um retry manual é feito. Vai de 0 até RETRY_DELAYS_MS.length.
  const retryCountRef = useRef(0);

  // Timer do "watchdog": se o stream simplesmente não responder nada (nem
  // readyToPlay nem error) dentro de 20s de uma tentativa, tratamos como
  // timeout e entramos no mesmo fluxo de retry — em vez de mostrar erro
  // direto, como acontecia antes.
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWatchdog = () => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  };

  // Agenda uma nova tentativa automática pro episódio dado, respeitando a
  // janela de ~60s (RETRY_DELAYS_MS). Retorna true se agendou (chamador
  // deve esperar, sem mostrar erro), false se as tentativas se esgotaram
  // (chamador deve mostrar o erro final).
  const scheduleRetry = (episode: Episode): boolean => {
    if (retryCountRef.current >= RETRY_DELAYS_MS.length) {
      return false;
    }
    const delay = RETRY_DELAYS_MS[retryCountRef.current];
    retryCountRef.current += 1;
    setRetryAttempt(retryCountRef.current);
    console.log(`🔁 Erro ao carregar o stream (tentativa ${retryCountRef.current}/${RETRY_DELAYS_MS.length}), tentando novamente em ${delay}ms...`);
    setTimeout(() => {
      if (selectedEpisodeRef.current === episode) {
        attemptPlaybackRef.current?.(episode);
      }
    }, delay);
    return true;
  };

  const armWatchdog = (episode: Episode) => {
    clearWatchdog();
    watchdogTimerRef.current = setTimeout(() => {
      if (selectedEpisodeRef.current !== episode) return;
      console.log('⏱️ Stream não respondeu em 20s, tratando como timeout...');
      if (scheduleRetry(episode)) return;
      setError(
        'O stream não respondeu a tempo. O formato pode não ser compatível (ex: TS bruto em vez de HLS/m3u8), ou o servidor pode estar bloqueando a conexão.'
      );
      setLoading(false);
    }, 20000);
  };

  // Garante que nenhum watchdog fique pendente depois que a tela é
  // desmontada (evita setState em componente já desmontado).
  useEffect(() => {
    return () => clearWatchdog();
  }, []);

  // Função reutilizável de "tentar tocar este episódio agora", usada
  // tanto pela troca normal de fonte quanto pelo retry automático/manual.
  const attemptPlayback = async (episode: Episode) => {
    setLoading(true);
    setError(null);
    armWatchdog(episode);
    try {
      console.log('▶️ Trocando fonte e iniciando reprodução:', episode.url);

      // Alguns servidores de vídeo bloqueiam requisições sem um Referer
      // que bata com o próprio domínio deles (proteção contra hotlink) —
      // isso costuma aparecer como erro 403. Mandamos o Referer baseado
      // no próprio host do vídeo como tentativa genérica de contornar.
      let referer: string | undefined;
      try {
        referer = `${new URL(episode.url).origin}/`;
      } catch {
        referer = undefined;
      }

      await player.replaceAsync({
        uri: episode.url,
        headers: {
          'User-Agent': USER_AGENT,
          ...(referer ? { Referer: referer } : {}),
        },
      });
      if (resumePosition > 0 && episode === selectedEpisode) {
        player.currentTime = resumePosition;
      }
      await player.play();
      // Não zeramos loading/error aqui: quem faz isso é o listener de
      // statusChange abaixo, que reflete o estado real do player.
    } catch (err) {
      console.error('❌ Erro ao reproduzir:', err);
      clearWatchdog();
      if (scheduleRetry(episode)) return;
      setError('Erro ao reproduzir: ' + String(err));
      setLoading(false);
    }
  };
  attemptPlaybackRef.current = attemptPlayback;

  // Retry manual: reseta o contador (pra permitir uma nova janela de
  // ~60s de auto-retry também) e tenta tocar o episódio atual de novo.
  const handleManualRetry = () => {
    if (!selectedEpisode) return;
    retryCountRef.current = 0;
    setRetryAttempt(0);
    attemptPlayback(selectedEpisode);
  };

  // Troca a fonte do player sempre que o episódio selecionado mudar
  // (seja a escolha inicial ou uma troca manual pelo seletor).
  useEffect(() => {
    if (!player || !selectedEpisode) return;
    retryCountRef.current = 0;
    setRetryAttempt(0);

    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await attemptPlayback(selectedEpisode);
    })();

    return () => {
      cancelled = true;
    };
  }, [player, resumePosition, selectedEpisode]);

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
            {resolving
              ? 'Lendo playlist...'
              : retryAttempt > 0
                ? `Reconectando... (tentativa ${retryAttempt}/${RETRY_DELAYS_MS.length})`
                : 'Carregando vídeo...'}
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
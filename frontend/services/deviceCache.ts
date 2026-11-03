import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@lk-clip/cache/';
const FAILED_CONTENT_KEY = '@lk-clip/failed-content';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
// Um conteúdo marcado como falho NÃO fica escondido pra sempre — o link de
// origem pode ser corrigido do lado do servidor a qualquer momento (ex:
// witflixbr trocando o link, ou um 403 temporário de rate-limit). Passado
// esse tempo, ele volta a aparecer e é testado de novo automaticamente, sem
// precisar de ação manual em Definições.
const FAILED_TTL_MS = 3 * 60 * 60 * 1000;

type CacheRecord<T> = { savedAt: number; value: T };

export async function readDeviceCache<T>(key: string): Promise<{ value: T; fresh: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const record = JSON.parse(raw) as CacheRecord<T>;
    if (typeof record.savedAt !== 'number' || !('value' in record)) return null;
    return { value: record.value, fresh: Date.now() - record.savedAt < DEFAULT_TTL_MS };
  } catch {
    return null;
  }
}

export async function writeDeviceCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({ savedAt: Date.now(), value }));
  } catch (error) {
    console.warn('Não foi possível guardar o cache no dispositivo:', error);
  }
}

type FailedEntry = { url: string; failedAt: number };

async function readFailedEntries(): Promise<FailedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_CONTENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Aceita o formato antigo (array de strings, sem timestamp) como já
    // expirado — melhor testar de novo do que esconder pra sempre por causa
    // de uma instalação anterior a essa mudança.
    return parsed
      .map((entry): FailedEntry | null => {
        if (typeof entry === 'string') return { url: entry, failedAt: 0 };
        if (entry && typeof entry === 'object' && typeof (entry as FailedEntry).url === 'string') {
          const failedAt = (entry as FailedEntry).failedAt;
          return { url: (entry as FailedEntry).url, failedAt: typeof failedAt === 'number' ? failedAt : 0 };
        }
        return null;
      })
      .filter((entry): entry is FailedEntry => entry !== null);
  } catch {
    return [];
  }
}

export async function getFailedContentUrls(): Promise<Set<string>> {
  const entries = await readFailedEntries();
  const now = Date.now();
  return new Set(entries.filter((entry) => now - entry.failedAt < FAILED_TTL_MS).map((entry) => entry.url));
}

export async function markContentAsFailed(url: string): Promise<void> {
  const now = Date.now();
  // Também aproveita pra descartar entradas já expiradas, em vez de deixar
  // a lista crescer com lixo que nunca mais vai importar.
  const stillValid = (await readFailedEntries()).filter(
    (entry) => entry.url !== url && now - entry.failedAt < FAILED_TTL_MS
  );
  const next = [...stillValid, { url, failedAt: now }].slice(-500);
  try {
    await AsyncStorage.setItem(FAILED_CONTENT_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Não foi possível guardar o conteúdo indisponível:', error);
  }
}

export async function filterFailedContent<T extends { url: string }>(entries: T[]): Promise<T[]> {
  const failed = await getFailedContentUrls();
  return entries.filter((entry) => !failed.has(entry.url));
}

/** Usado em Definições — apaga só as listas guardadas (playlists, IPTV,
 * domínio público), nunca a sessão de login nem os downloads. */
export async function clearDeviceCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
  if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
}

/** Usado em Definições — "esquece" os conteúdos marcados como
 * indisponíveis, pra eles voltarem a aparecer e serem testados de novo. */
export async function clearFailedContent(): Promise<void> {
  await AsyncStorage.removeItem(FAILED_CONTENT_KEY);
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@lk-clip/cache/';
const FAILED_CONTENT_KEY = '@lk-clip/failed-content';
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

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

export async function getFailedContentUrls(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(FAILED_CONTENT_KEY);
    const urls: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(urls) ? urls.filter((url): url is string => typeof url === 'string') : []);
  } catch {
    return new Set();
  }
}

export async function markContentAsFailed(url: string): Promise<void> {
  const failed = await getFailedContentUrls();
  failed.add(url);
  try {
    await AsyncStorage.setItem(FAILED_CONTENT_KEY, JSON.stringify([...failed].slice(-500)));
  } catch (error) {
    console.warn('Não foi possível guardar o conteúdo indisponível:', error);
  }
}

export async function filterFailedContent<T extends { url: string }>(entries: T[]): Promise<T[]> {
  const failed = await getFailedContentUrls();
  return entries.filter((entry) => !failed.has(entry.url));
}

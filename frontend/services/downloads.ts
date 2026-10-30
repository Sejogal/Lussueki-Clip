import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADS_KEY = '@lk-clip/downloads';
const DOWNLOAD_DIRECTORY = `${FileSystem.documentDirectory}downloads/`;

export type DownloadedMedia = { url: string; title: string; uri: string; savedAt: number };
export type DownloadProgress = { writtenBytes: number; totalBytes: number | null };

function hashUrl(url: string): string {
  let hash = 2166136261;
  for (let index = 0; index < url.length; index += 1) {
    hash ^= url.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function readDownloads(): Promise<DownloadedMedia[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
    const entries: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(entries) ? entries.filter((entry) => entry && typeof entry.url === 'string' && typeof entry.uri === 'string') : [];
  } catch {
    return [];
  }
}

export async function getDownloadedMedia(url: string): Promise<DownloadedMedia | null> {
  const item = (await readDownloads()).find((download) => download.url === url);
  if (!item) return null;
  try {
    const file = await FileSystem.getInfoAsync(item.uri);
    return file.exists ? item : null;
  } catch {
    return null;
  }
}

export async function downloadMedia(
  url: string,
  title: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadedMedia> {
  if (!FileSystem.documentDirectory) throw new Error('Armazenamento local indisponível neste dispositivo.');
  const extension = url.split('?')[0].match(/\.(mp4|mkv|mov|webm|mp3)$/i)?.[0].toLowerCase() ?? '.mp4';
  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIRECTORY, { intermediates: true });
  const uri = `${DOWNLOAD_DIRECTORY}${hashUrl(url)}${extension}`;
  const task = FileSystem.createDownloadResumable(url, uri, {}, (progress) => {
    onProgress?.({
      writtenBytes: progress.totalBytesWritten,
      totalBytes: progress.totalBytesExpectedToWrite > 0 ? progress.totalBytesExpectedToWrite : null,
    });
  });
  const result = await task.downloadAsync();
  if (!result) throw new Error('O download foi interrompido.');
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`O servidor respondeu com HTTP ${result.status}.`);
  }
  const downloaded: DownloadedMedia = { url, title, uri: result.uri, savedAt: Date.now() };
  const entries = (await readDownloads()).filter((entry) => entry.url !== url);
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify([downloaded, ...entries]));
  return downloaded;
}

export async function removeDownload(url: string): Promise<void> {
  const entries = await readDownloads();
  const item = entries.find((entry) => entry.url === url);
  if (item) await FileSystem.deleteAsync(item.uri, { idempotent: true });
  await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(entries.filter((entry) => entry.url !== url)));
}

export async function listDownloads(): Promise<DownloadedMedia[]> {
  const entries = await readDownloads();
  const available: DownloadedMedia[] = [];
  for (const entry of entries) {
    try {
      const file = await FileSystem.getInfoAsync(entry.uri);
      if (file.exists) available.push(entry);
    } catch {
      // Ignora um ficheiro removido pelo sistema ou por uma instalação antiga.
    }
  }
  return available;
}

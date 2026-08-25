// services/iptv.ts
import { IPTV_SOURCE_URL } from '@/config/iptv';
import { groupIptvChannels, IptvCategory, parseIptvPlaylist } from '@/utils/iptv';

// Cache em memória: o arquivo de origem tem milhares de canais, então
// buscamos e parseamos só UMA VEZ por sessão do app, não a cada vez que
// a tela de IPTV é aberta. `cachePromise` também evita buscas duplicadas
// em paralelo se a tela remontar rápido (ex: navegação rápida).
let cache: IptvCategory[] | null = null;
let cachePromise: Promise<IptvCategory[]> | null = null;

export async function fetchIptvCatalog(): Promise<IptvCategory[]> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    console.log('📡 Buscando catálogo IPTV de:', IPTV_SOURCE_URL);
    const response = await fetch(IPTV_SOURCE_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao buscar a playlist IPTV`);
    }

    const text = await response.text();
    const channels = parseIptvPlaylist(text, IPTV_SOURCE_URL);
    const grouped = groupIptvChannels(channels);

    console.log(`✅ IPTV: ${channels.length} canais em ${grouped.length} categorias`);
    cache = grouped;
    return grouped;
  })().catch((err) => {
    // Em caso de erro, limpa a promise em cache pra permitir tentar de
    // novo na próxima chamada (não fica "travado" num erro antigo).
    cachePromise = null;
    throw err;
  });

  return cachePromise;
}

/** Força buscar de novo na próxima chamada (ex: pull-to-refresh). */
export function invalidateIptvCache(): void {
  cache = null;
  cachePromise = null;
}
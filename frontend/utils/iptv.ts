// utils/iptv.ts
//
// Parser pro formato M3U PADRÃO de IPTV (usado pelo iptv-org e pela
// imensa maioria das listas de canais ao vivo):
//
//   #EXTM3U
//   #EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="Categoria",Nome do Canal
//   http://.../stream
//
// Isso é diferente do #EXTINF:-1="URL_DO_POSTER",Título usado pelas
// outras fontes do app — por isso um parser separado, em vez de tentar
// forçar o mesmo parser genérico a entender os dois formatos.

import { PlaylistEntry } from '@/utils/playlist';

export type IptvChannel = PlaylistEntry & {
  group: string;
};

export type IptvCategory = {
  group: string;
  channels: IptvChannel[];
};

function extractAttribute(attrString: string, name: string): string | undefined {
  const match = attrString.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1] : undefined;
}

export function parseIptvPlaylist(text: string, baseUrl: string): IptvChannel[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const channels: IptvChannel[] = [];

  let pendingTitle: string | null = null;
  let pendingLogo: string | undefined;
  let pendingGroup: string | undefined;

  for (const line of lines) {
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      // Tudo antes da ÚLTIMA vírgula são os atributos (tvg-id, tvg-logo,
      // group-title...); depois da última vírgula vem o nome do canal.
      const commaIndex = line.lastIndexOf(',');
      const attrPart = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const title = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : null;

      pendingLogo = extractAttribute(attrPart, 'tvg-logo');
      pendingGroup = extractAttribute(attrPart, 'group-title');
      pendingTitle = title;
      continue;
    }

    if (line.startsWith('#')) continue;

    try {
      const resolvedUrl = new URL(line, baseUrl).toString();
      channels.push({
        title: pendingTitle || resolvedUrl,
        url: resolvedUrl,
        posterUrl: pendingLogo,
        group: pendingGroup?.trim() || 'Outros',
      });
    } catch {
      // Ignora linhas que não formam uma URL válida
    }

    pendingTitle = null;
    pendingLogo = undefined;
    pendingGroup = undefined;
  }

  return channels;
}

/**
 * Agrupa os canais pelo group-title, ordenando as categorias com mais
 * canais primeiro (tende a colocar as categorias mais relevantes/gerais
 * no topo da tela).
 */
export function groupIptvChannels(channels: IptvChannel[]): IptvCategory[] {
  const map = new Map<string, IptvChannel[]>();

  for (const channel of channels) {
    const key = channel.group || 'Outros';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(channel);
  }

  return Array.from(map.entries())
    .map(([group, groupChannels]) => ({ group, channels: groupChannels }))
    .sort((a, b) => b.channels.length - a.channels.length);
}
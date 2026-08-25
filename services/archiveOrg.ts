// services/archiveOrg.ts
//
// Integração com as APIs PÚBLICAS e oficiais do archive.org — usadas
// aqui apenas para conteúdo de domínio público (filmes antigos, curtas,
// documentários sem direitos autorais vigentes). Diferente da fonte
// witflixbr, isso é uma API JSON de verdade, documentada pelo próprio
// archive.org: https://archive.org/advancedsearch.php
//
// Fluxo:
// 1) searchArchiveOrg(query) — busca itens (título + identifier + capa)
// 2) getArchiveOrgPlayableUrl(identifier) — só quando o usuário tenta
//    tocar um item, busca os metadados dele e escolhe o melhor arquivo
//    de vídeo disponível pra streaming.

import { PlaylistEntry } from '@/utils/playlist';

const ADVANCED_SEARCH_URL = 'https://archive.org/advancedsearch.php';
const METADATA_URL = 'https://archive.org/metadata';

const New = "https://iptv-org.github.io/iptv/index.m3u"

// Prefixo usado pra marcar um PlaylistEntry.url como "item do archive.org
// pendente de resolução" — o player.tsx reconhece esse prefixo e busca o
// arquivo de vídeo real só na hora de tocar (evita ter que chamar a API
// de metadados de dezenas de itens só pra montar uma lista).
export const ARCHIVE_ITEM_PREFIX = 'archive-item:';

export type PublicDomainCategory = {
  key: string;
  label: string;
  icon: string;
  /** Query no formato de busca do archive.org (mesma sintaxe do site). */
  query: string;
};

// Algumas coleções/curadorias conhecidas de domínio público no
// archive.org. Ajuste/adicione categorias livremente — é só uma query.
export const PUBLIC_DOMAIN_CATEGORIES: PublicDomainCategory[] = [
  {
    key: 'classic-feature-films',
    label: 'Filmes Clássicos',
    icon: '🎞️',
    query: 'mediatype:(movies) AND collection:(feature_films)',
  },
  {
    key: 'silent-films',
    label: 'Filmes Mudos',
    icon: '🎬',
    query: 'mediatype:(movies) AND subject:("silent film")',
  },
  {
    key: 'sci-fi-classics',
    label: 'Ficção Científica Vintage',
    icon: '🚀',
    query: 'mediatype:(movies) AND subject:("science fiction") AND collection:(feature_films)',
  },
  {
    key: 'horror-classics',
    label: 'Terror Clássico',
    icon: '🕯️',
    query: 'mediatype:(movies) AND subject:("horror") AND collection:(feature_films)',
  },
  {
    key: 'classic-cartoons',
    label: 'Desenhos Vintage',
    icon: '🎨',
    query: 'mediatype:(movies) AND collection:(classic_cartoons)',
  },
  {
    key: 'prelinger-shorts',
    label: 'Curtas & Educativos',
    icon: '🎥',
    query: 'mediatype:(movies) AND collection:(prelinger)',
  },
];

type ArchiveSearchDoc = {
  identifier: string;
  title?: string;
};

export async function searchArchiveOrg(query: string, rows = 24): Promise<PlaylistEntry[]> {
  const url =
    `${ADVANCED_SEARCH_URL}?q=${encodeURIComponent(query)}` +
    `&fl[]=identifier&fl[]=title` +
    `&sort[]=downloads+desc` +
    `&rows=${rows}&page=1&output=json`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar no archive.org`);
  }

  const data = await response.json();
  const docs: ArchiveSearchDoc[] = data?.response?.docs ?? [];

  return docs
    .filter((doc) => !!doc.identifier)
    .map((doc) => ({
      title: doc.title || doc.identifier,
      url: `${ARCHIVE_ITEM_PREFIX}${doc.identifier}`,
      // O archive.org gera automaticamente uma thumbnail pra qualquer
      // item a partir desse endpoint — não precisa buscar metadados
      // só pra mostrar o pôster na lista.
      posterUrl: `https://archive.org/services/img/${doc.identifier}`,
    }));
}

type ArchiveMetadataFile = {
  name: string;
  format?: string;
  size?: string;
};

type ArchiveMetadataResponse = {
  metadata?: { title?: string };
  files?: ArchiveMetadataFile[];
};

/**
 * Busca os metadados de um item e escolhe o melhor arquivo de vídeo pra
 * streaming. Itens do archive.org costumam ter o arquivo original (muito
 * grande, lento pra streaming progressivo) e versões derivadas menores
 * (ex: "512Kb MPEG4") — preferimos as menores quando existem.
 */
export async function getArchiveOrgPlayableUrl(
  identifier: string
): Promise<{ url: string; title?: string } | null> {
  const response = await fetch(`${METADATA_URL}/${identifier}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar metadados de ${identifier}`);
  }

  const data: ArchiveMetadataResponse = await response.json();
  const files = data.files ?? [];

  const mp4Files = files.filter((file) => (file.name || '').toLowerCase().endsWith('.mp4'));
  if (mp4Files.length === 0) return null;

  const bySize = [...mp4Files].sort((a, b) => (parseInt(a.size || '0', 10) || 0) - (parseInt(b.size || '0', 10) || 0));

  // Se houver mais de uma versão, evita a menor (às vezes é um preview
  // minúsculo) e a maior (o original, pesado) — pega uma do meio quando
  // possível; senão, usa a única disponível.
  const chosen = bySize.length >= 3 ? bySize[1] : bySize[bySize.length - 1];

  return {
    url: `https://archive.org/download/${identifier}/${encodeURIComponent(chosen.name)}`,
    title: data.metadata?.title,
  };
}
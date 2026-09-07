// config/index.ts

// Nome do app usado em qualquer lugar da UI (Home, título de aba, etc).
// Centralizado aqui pra nunca mais precisar trocar em vários arquivos.
export const APP_NAME = 'Lussueki clip';

export type CategoryKey =
  | 'series'
  | 'filmes'
  | 'animes'
  | 'desenhos'
  | 'animacoes'
  | 'tokusatsu'
  | 'doramas'
  | 'novelas'
  | 'shows'
  | 'gospel';

export type CategoryConfig = {
  /** Nome exibido na Home */
  label: string;
  /** Emoji usado como ícone da categoria */
  icon: string;
  /**
   * Fonte primária de conteúdo. Pode ser:
   * - Um diretório do archive.org (ex: ".../Series/") com listagem de .m3u
   * - Um paste.php?raw&id=XXX (texto EXTM3U com título + pôster + link)
   */
  link1?: string;
  /** Fonte alternativa/secundária, mesmo formato de link1 */
  link2?: string;
  /** Imagem de capa da categoria (usada no header/hero, não por item) */
  capa?: string;
};

// NOTA: os valores abaixo foram herdados do index.js original, apenas
// tipados e organizados. Ajuste aqui se algum link mudar no futuro —
// nada no resto do app depende de URLs hardcoded fora deste arquivo.
export const CATEGORIES: Record<CategoryKey, CategoryConfig> = {
  series: {
    label: 'Séries',
    icon: '📺',
    link1: 'https://dn721505.ca.archive.org/0/items/witflixseries/Series/',
    link2: 'http://witflixbr.atspace.cc/paste.php?raw&id=240',
    capa: 'http://archive.org/download/witflixseries/Series.jpg',
  },
  filmes: {
    label: 'Filmes',
    icon: '🎬',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=386',
    capa: 'http://archive.org/download/witflixsinopses/Filmes.jpg',
  },
  animes: {
    label: 'Animes',
    icon: '🇯🇵',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=326',
    capa: 'http://archive.org/download/witflixanimes/Animes.jpg',
  },
  desenhos: {
    label: 'Desenhos',
    icon: '🧒',
    link1: 'https://archive.org/download/witflixinfantil/Infantil/',
    link2: 'http://witflixbr.atspace.cc/paste.php?raw&id=332',
    capa: 'http://archive.org/download/witflixinfantil/Infantil.jpg',
  },
  animacoes: {
    label: 'Animações',
    icon: '🎨',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=334',
    capa: 'http://archive.org/download/wittflixanimacoes/Animacoes.jpg',
  },
  tokusatsu: {
    label: 'Tokusatsu',
    icon: '🦸',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=331',
    capa: 'http://archive.org/download/witfilxtokusatsu/Tokusatsu.jpg',
  },
  doramas: {
    label: 'Doramas',
    icon: '🇰🇷',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=388',
    capa: 'http://archive.org/download/witflixdoramas/Doramas.jpg',
  },
  novelas: {
    label: 'Novelas',
    icon: '💔',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=333',
    capa: 'http://archive.org/download/witflixnovelas/Novelas.jpg',
  },
  shows: {
    label: 'Shows',
    icon: '🎤',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=362',
    capa: 'http://archive.org/download/witflixshows/Shows.jpg',
  },
  gospel: {
    label: 'Gospel',
    icon: '⛪',
    link1: 'http://witflixbr.atspace.cc/paste.php?raw&id=327',
    capa: 'http://archive.org/download/witflixgospel/Gospel.jpg',
  },
};

// Ordem de exibição das fileiras na Home. Ajuste livremente.
export const CATEGORY_ORDER: CategoryKey[] = [
  'series',
  'filmes',
  'animes',
  'desenhos',
  'animacoes',
  'doramas',
  'novelas',
  'tokusatsu',
  'shows',
  'gospel',
];

// Mantido por compatibilidade com código antigo que importava
// API_BASE_URL diretamente (ex: services antigos). Novo código deve
// usar CATEGORIES/fetchCategoryContent em vez disso.
export const API_BASE_URL = CATEGORIES.series.link1;
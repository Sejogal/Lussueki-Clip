// utils/tmdb.ts
//
// Os pôsteres que vêm embutidos nas playlists (via #EXTINF) geralmente
// apontam pra uma resolução pequena do TMDB (ex: w154 — boa pra listas,
// pixelizada se usada grande). Esse helper troca o tamanho na própria URL
// pra pedir uma resolução maior, sem precisar de outra chamada de API.
//
// Tamanhos válidos do TMDB: w92, w154, w185, w342, w500, w780, original.

export function getHiResImage(url?: string, size: string = 'w500'): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/t\/p\/w\d+\//, `/t/p/${size}/`);
}

// As playlists (EXTINF e `capa` em config/index.ts) trazem os pôsteres do
// TMDB e as capas do archive.org em HTTP simples (ex.:
// "http://image.tmdb.org/t/p/w154/xxx.jpg"). No telemóvel isso nunca
// chega a aparecer: o iOS bloqueia pedidos HTTP por omissão (App
// Transport Security) e o Android recusa "cleartext" a não ser que a app
// o permita explicitamente — sem erro visível, a imagem simplesmente
// nunca carrega (só o título, que não depende de rede, fica no ecrã).
// Estes hosts servem exatamente a mesma imagem por HTTPS, por isso o
// protocolo é sempre atualizado para eles; outros hosts de pôsteres das
// playlists ficam tal como vêm, porque nem todos respondem por HTTPS.
const HTTPS_UPGRADE_HOSTS = /^https?:\/\/((?:[\w-]+\.)*(?:tmdb\.org|themoviedb\.org|archive\.org))\//i;

/**
 * Normaliza a URL de um pôster vinda das playlists: resolve formatos
 * parciais (protocolo relativo, caminho TMDB sem domínio, domínio sem
 * protocolo) e força HTTPS nos hosts conhecidos por suportá-lo
 * (TMDB, archive.org) — usar sempre antes de passar a URL a um `Image`.
 */
export function normalizePosterUrl(url?: string): string | undefined {
  const value = url?.trim().replace(/&amp;/g, '&');
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/t/p/')) return `https://image.tmdb.org${value}`;
  if (value.startsWith('t/p/')) return `https://image.tmdb.org/${value}`;
  if (value.startsWith('www.')) return `https://${value}`;
  if (/^(image\.tmdb\.org|www\.themoviedb\.org)\//i.test(value)) return `https://${value}`;
  if (HTTPS_UPGRADE_HOSTS.test(value)) return value.replace(/^http:\/\//i, 'https://');
  return value;
}
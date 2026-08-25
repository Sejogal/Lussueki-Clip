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
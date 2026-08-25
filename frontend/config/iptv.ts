// config/iptv.ts
//
// Fonte de canais de TV ao vivo (IPTV). Formato: playlist M3U estendida
// padrão (tvg-logo, group-title por canal) — diferente do formato
// customizado usado pelas outras fontes do app.
//
// Pra trocar de provedor no futuro, troque só esta URL.
export const IPTV_SOURCE_URL = 'https://iptv-org.github.io/iptv/index.m3u';
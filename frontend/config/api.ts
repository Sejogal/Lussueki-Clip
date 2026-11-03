// config/api.ts
//
// URL base do backend (LK-CLIP API), compartilhada por qualquer serviço
// que precise chamá-lo diretamente (auth, catálogo via proxy Cloudflare,
// etc). Centralizado aqui para não repetir o mesmo trim/validação em
// cada arquivo de serviço.
const rawApiUrl = process.env.EXPO_PUBLIC_LK_CLIP_API_URL?.trim();
export const API_URL = rawApiUrl?.replace(/\/$/, '');

export function getApiUrl(): string {
  if (!API_URL) {
    throw new Error(
      'Configure EXPO_PUBLIC_LK_CLIP_API_URL com o endereço do backend antes de entrar na conta.'
    );
  }
  return API_URL;
}

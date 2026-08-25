// utils/categoryDisplay.ts
import { CATEGORIES, CategoryKey } from '@/config/index';
import { PUBLIC_DOMAIN_CATEGORIES } from '@/services/archiveOrg';

/**
 * Resolve ícone/nome de uma categoria, seja ela uma das categorias
 * "legado" (config/index.ts), uma categoria de domínio público
 * (archive.org), ou um grupo de canais de IPTV (prefixo "iptv:"). Usado
 * em qualquer lugar que precise mostrar a origem de um item sem saber de
 * antemão qual das três fontes ele veio.
 */
export function getCategoryDisplay(key?: string): { icon: string; label: string } {
  if (!key) return { icon: '🎬', label: '' };

  if (key.startsWith('iptv:')) {
    return { icon: '📺', label: key.slice('iptv:'.length) };
  }

  if (key in CATEGORIES) {
    const config = CATEGORIES[key as CategoryKey];
    return { icon: config.icon, label: config.label };
  }

  const publicDomain = PUBLIC_DOMAIN_CATEGORIES.find((category) => category.key === key);
  if (publicDomain) {
    return { icon: publicDomain.icon, label: publicDomain.label };
  }

  return { icon: '🎬', label: '' };
}
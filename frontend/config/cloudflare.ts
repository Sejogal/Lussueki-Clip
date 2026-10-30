// config/cloudflare.ts
//
// As categorias Cloudflare são descobertas automaticamente em tempo de
// execução (GET /catalog devolve o manifesto publicado na origem — ver
// services/cloudflareCatalog.ts e backend/routes/catalog.py). Isso é de
// propósito: publicar uma categoria nova (ou atualizar o conteúdo de uma
// já existente) é só fazer upload do JSON na origem — nunca mexer neste
// ficheiro nem publicar uma nova versão do app.
//
// Esta lista serve só de EXTRA/fallback — categorias fixas no código, úteis
// só se você quiser garantir uma fileira mesmo sem (ou antes de) configurar
// o manifesto. Fica vazia por padrão; o caminho normal é o manifesto.
import type { CloudflareCategory } from '@/services/cloudflareCatalog';

export type { CloudflareCategory };

export const CLOUDFLARE_CATEGORIES: CloudflareCategory[] = [];

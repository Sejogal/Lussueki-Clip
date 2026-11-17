// utils/fetchWithTimeout.ts
//
// `fetch()` nunca teve limite de tempo em nenhum sítio do app: contra uma
// fonte lenta ou inalcançável (comum nos hospedeiros gratuitos usados
// pelas playlists), um só pedido preso ficava pendente para sempre — sem
// nunca resolver nem rejeitar. Isso travava silenciosamente qualquer
// ecrã que esperasse por ele; o caso mais visível é o banner de
// destaques da Home, que busca várias categorias em paralelo
// (Promise.all) e por isso nunca chegava a esconder o indicador de
// carregamento se SÓ UMA delas nunca respondesse.
const DEFAULT_TIMEOUT_MS = 12_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Tempo esgotado (${Math.round(timeoutMs / 1000)}s) ao contactar ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

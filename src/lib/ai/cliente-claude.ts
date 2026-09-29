import Anthropic from '@anthropic-ai/sdk';

/**
 * fetch nativo do runtime. No Cloudflare (workerd) o SDK cai no shim de Node,
 * que usa node-fetch + agent de keep-alive e não consegue abrir a conexão
 * (APIConnectionError em toda chamada). O `agent` que o SDK injeta é removido
 * porque o fetch nativo não o conhece.
 */
export const fetchNativo = ((url: RequestInfo | URL, init?: RequestInit & { agent?: unknown }) => {
  const { agent: _agent, ...resto } = init ?? {};
  return globalThis.fetch(url, resto);
}) as unknown as NonNullable<ConstructorParameters<typeof Anthropic>[0]>['fetch'];

/** Único jeito de criar o cliente da Claude no app. */
export function criarClienteClaude(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, fetch: fetchNativo });
}

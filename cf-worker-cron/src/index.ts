/**
 * Worker separado: dispara crons do TinDo.
 * CF Pages não suporta triggers/crons nativos — este Worker faz fetch aos endpoints.
 *
 * Schedule:
 *   - "0 6 * * *" (diário 06h UTC) → /api/cron/diario (KPIs + sync completo + push)
 *   - "0/5 * * * *" (a cada 5 min) → /api/todoist/sync (sync rápido)
 *
 * Deploy: cd cf-worker-cron && wrangler deploy
 */

interface Env {
  CRON_SECRET: string;
}

const BASE_URL = 'https://tindo.falecomyaax.workers.dev';

async function dispararDiario(env: Env): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/cron/diario`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text().catch(() => '');
  console.log(`[diario] ${res.status}`, body.slice(0, 200));
  if (!res.ok) throw new Error(`diario falhou com ${res.status}: ${body}`);
}

async function dispararSyncTodoist(env: Env): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/todoist/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  const body = await res.text().catch(() => '');
  console.log(`[todoist-sync] ${res.status}`, body.slice(0, 200));
  // 401 pode ser porque o endpoint não valida auth ainda — só loga, não falha o worker
  if (!res.ok && res.status !== 401) {
    throw new Error(`todoist-sync falhou com ${res.status}: ${body}`);
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    // cron expression disponível em event.cron
    const { cron } = event;

    if (cron === '0 6 * * *') {
      await dispararDiario(env);
    } else if (cron === '*/5 * * * *') {
      await dispararSyncTodoist(env);
    } else {
      console.log(`[worker] cron desconhecido: ${cron}`);
    }
  },
};

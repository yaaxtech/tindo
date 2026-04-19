/**
 * Worker separado: dispara o cron diário do TinDo.
 * CF Pages não suporta triggers/crons nativos — este Worker faz fetch ao endpoint.
 * Deploy: cd cf-worker-cron && wrangler secret put CRON_SECRET && wrangler deploy
 */

interface Env {
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const url = 'https://tindo-6qy.pages.dev/api/cron/diario';
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await res.text().catch(() => '');
    console.log(`Cron result: ${res.status}`, body.slice(0, 200));

    if (!res.ok) {
      throw new Error(`Cron falhou com status ${res.status}: ${body}`);
    }
  },
};

import { respostaOk, rotaApi } from '@/lib/api/resposta';
import { getHarnessSnapshotPublico } from '@/services/harness-servidor';

// Snapshot cru (v2) para IAs e scripts. Leitura pública, igual à página /harness.
export const dynamic = 'force-dynamic';

export const GET = rotaApi('GET /harness.json', async () =>
  respostaOk(await getHarnessSnapshotPublico(), {
    headers: { 'cache-control': 'public, max-age=300' },
  }),
);

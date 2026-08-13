export const dynamic = 'force-dynamic';

import { ROTULO_ALERTA } from '@/lib/harness/alertas';
import { coletarRunsGithub, resumoColeta } from '@/lib/harness/coletor-github';
import { resumoRevisao, revisarKpis } from '@/lib/harness/revisor';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { marcarRecalibracaoSugerida, verificarGatilhos } from '@/services/calibracao';
import { enviarPush } from '@/services/push';
import type { GithubRunLinha, HarnessBlob } from '@/types/harness';
import { type NextRequest, NextResponse } from 'next/server';

async function handler(request: NextRequest) {
  // Auth via header
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();
  const resultados: Record<string, unknown> = {};

  // 1. Refresh KPIs
  try {
    const { error } = await admin.rpc('refresh_kpis_usuario_diario');
    resultados.kpis_refresh = error ? `erro: ${error.message}` : 'ok';
  } catch (e) {
    resultados.kpis_refresh = `erro: ${(e as Error).message}`;
  }

  // 2. Sync Todoist (se habilitado) — chama endpoint interno
  try {
    const { data: cfg } = await admin
      .from('configuracoes')
      .select('todoist_sync_habilitado')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    // biome-ignore lint/suspicious/noExplicitAny: config é jsonb
    if ((cfg as any)?.todoist_sync_habilitado) {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/todoist/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      resultados.todoist_sync = res.ok ? 'ok' : `http_${res.status}`;
    } else {
      resultados.todoist_sync = 'flag off';
    }
  } catch (e) {
    resultados.todoist_sync = `erro: ${(e as Error).message}`;
  }

  // 3. Marca recalibração sugerida se gatilhos ativos
  // verificarGatilhos() e marcarRecalibracaoSugerida(motivo) resolvem usuarioId internamente
  try {
    const gat = await verificarGatilhos();
    if (gat.deveRecalibrar) {
      const motivo = gat.gatilhos.map((g) => g.codigo).join(', ');
      await marcarRecalibracaoSugerida(motivo);
      resultados.recalibracao = 'sugerida';
    } else {
      resultados.recalibracao = 'não necessária';
    }
  } catch (e) {
    resultados.recalibracao = `erro: ${(e as Error).message}`;
  }

  // 4. Disparar push notifications (placeholder — outro agente implementa)
  resultados.push = 'pendente (agente push notifications)';

  // 5. Tempos crus do GitHub Actions para o Painel do Harness.
  // Sempre 90 dias com upsert por run_id: a 1ª execução semeia tudo sozinha e
  // as seguintes são baratas. Nunca derruba o cron — falha vira string aqui.
  try {
    const coleta = await coletarRunsGithub({
      async upsert(linhas: GithubRunLinha[]) {
        // harness_github_runs ainda não está no Database gerado; roda
        // `bun run db:types` após aplicar a migration em prod para tirar o cast.
        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { error } = await (admin as any)
          .from('harness_github_runs')
          .upsert(linhas, { onConflict: 'run_id' });
        return { erro: error ? error.message : null };
      },
    });
    resultados.github_runs = resumoColeta(coleta);
  } catch (e) {
    resultados.github_runs = `erro: ${(e as Error).message}`;
  }

  // 6. Revisor de KPIs do Painel do Harness.
  // O disparo vive AQUI, dentro do app: roda todo dia e a lib decide se hoje é
  // dia de avaliar (14 em 14 dias, ou 3 dias antes de uma renovação). Nenhum
  // agendador externo — nada que dependa de uma máquina ou conta de terceiro.
  try {
    const revisao = await revisarKpis({
      async lerLedger() {
        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { data } = await (admin as any)
          .from('harness_snapshot')
          .select('dados')
          .eq('id', 'singleton')
          .maybeSingle();
        const blob = data?.dados as HarnessBlob | undefined;
        if (!blob) return null;
        return { ledger: blob.ledger ?? [], assinaturas: blob.assinaturas ?? [] };
      },
      async lerRuns() {
        const desde = new Date(Date.now() - 35 * 864e5).toISOString();
        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { data, error } = await (admin as any)
          .from('harness_github_runs')
          .select(
            'run_id, repo, evento, branch, head_sha, conclusao, criado_em, iniciado_em, ' +
              'atualizado_em, pr_numero, pr_criado_em, pr_merged_em',
          )
          .gte('criado_em', desde)
          .order('criado_em', { ascending: false })
          .limit(1000);
        if (error) throw new Error(error.message);
        return (data ?? []) as GithubRunLinha[];
      },
      async ultimaAvaliacaoEm() {
        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { data } = await (admin as any)
          .from('harness_avaliacoes')
          .select('avaliado_em')
          .order('avaliado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        return (data?.avaliado_em as string | undefined) ?? null;
      },
      async gravar({ motivo, janelaDias, violacoes }) {
        const avaliadoEm = new Date().toISOString();
        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { data, error } = await (admin as any)
          .from('harness_avaliacoes')
          .insert({
            avaliado_em: avaliadoEm,
            motivo,
            janela_dias: janelaDias,
            violacoes_n: violacoes.length,
          })
          .select('id')
          .single();
        if (error) return { erro: error.message };
        if (violacoes.length === 0) return { erro: null };

        // biome-ignore lint/suspicious/noExplicitAny: tabela fora do Database tipado por ora
        const { error: erroItens } = await (admin as any).from('harness_alertas').insert(
          violacoes.map((v) => ({
            avaliacao_id: data.id as string,
            avaliado_em: avaliadoEm,
            codigo: v.codigo,
            severidade: v.severidade,
            valor: v.valor,
            limiar: v.limiar,
            amostra: v.amostra,
          })),
        );
        return { erro: erroItens ? erroItens.message : null };
      },
      async avisar(violacoes) {
        // Push é conveniência: a faixa no /harness é a entrega de verdade.
        // Falta de chave VAPID ou navegador sem inscrição não pode derrubar o cron.
        try {
          const criticos = violacoes.filter((v) => v.severidade === 'critico').length;
          const primeiro = violacoes[0];
          await enviarPush(usuarioId, 'harness_alerta', {
            titulo:
              criticos > 0
                ? 'Painel do Harness: algo passou do limite'
                : 'Painel do Harness: vale dar uma olhada',
            corpo: `${violacoes.length} ponto${violacoes.length === 1 ? '' : 's'} de atenção${primeiro ? ` — ${ROTULO_ALERTA[primeiro.codigo]}` : ''}.`,
            url: '/harness',
            tag: 'harness-alerta',
          });
        } catch {
          // silêncio proposital — o alerta já está gravado e visível na tela
        }
      },
    });
    resultados.harness_alertas = resumoRevisao(revisao);
  } catch (e) {
    resultados.harness_alertas = `erro: ${(e as Error).message}`;
  }

  return NextResponse.json({
    ok: true,
    usuarioId,
    executadoEm: new Date().toISOString(),
    resultados,
  });
}

export const POST = handler;

// Permite GET pra teste (com mesmo auth)
export const GET = handler;

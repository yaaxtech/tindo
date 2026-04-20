import { type AcaoAdiamentoPassada, decidirHoraDoDia } from '@/lib/adiamento/heuristica';
import {
  atualizarEfAdiamento,
  atualizarEfConclusao,
  calcularProximaAdiada,
} from '@/lib/adiamento/sm2';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';
import { propagarParaTodoist } from '@/services/todoistWriteback';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Acao =
  | { tipo: 'concluir' }
  | { tipo: 'adiar'; ate: string; motivoAuto?: string; automatico?: boolean }
  | { tipo: 'desfazer_adiamento' }
  | { tipo: 'excluir' };

/** Shape mínimo da tarefa carregada do DB */
type TarefaRow = {
  nota: number | null;
  ef: number | null;
  adiamento_count: number | null;
  prazo_conclusao: string | null;
  data_vencimento: string | null;
  tags: string[] | null;
  projeto_id: string | null;
};

/** Shape de um registro de historico_acoes para adiamento */
type HistoricoRow = {
  created_at: string;
  dados: { ateISO?: string; motivo?: string } | null;
  tarefa_id: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Acao;
    const admin = getAdminClient();
    const usuarioId = await getUsuarioIdMVP();

    switch (body.tipo) {
      case 'concluir': {
        // Busca tarefa para atualizar EF
        const { data: tarefa } = await admin
          .from('tarefas')
          .select('ef')
          .eq('id', id)
          .eq('usuario_id', usuarioId)
          .maybeSingle();

        const efAtual = tarefa?.ef ?? 2.5;
        const novoEf = atualizarEfConclusao(efAtual);

        const { error } = await admin
          .from('tarefas')
          .update({
            status: 'concluida',
            concluida_em: new Date().toISOString(),
            ef: novoEf,
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;

        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'concluida',
          dados: { ef: novoEf },
        });
        void propagarParaTodoist({ usuarioId, tarefaId: id, acao: 'concluir' });
        return NextResponse.json({ ok: true });
      }

      case 'adiar': {
        const agora = new Date();

        // Carrega dados completos da tarefa
        const { data: tarefa } = (await admin
          .from('tarefas')
          .select('nota, ef, adiamento_count, prazo_conclusao, data_vencimento, tags, projeto_id')
          .eq('id', id)
          .eq('usuario_id', usuarioId)
          .maybeSingle()) as { data: TarefaRow | null };

        const score = tarefa?.nota ?? 50;
        const efAtual = tarefa?.ef ?? 2.5;
        const countAtual = tarefa?.adiamento_count ?? 0;
        const novoCount = countAtual + 1;

        if (body.automatico) {
          // --- branch adiada_auto ---
          // Busca histórico de adiamentos para heurística
          const { data: historicoRaw } = (await admin
            .from('historico_acoes')
            .select('created_at, dados, tarefa_id')
            .eq('usuario_id', usuarioId)
            .in('acao', ['adiada_auto', 'adiada_manual'])
            .order('created_at', { ascending: false })
            .limit(200)) as { data: HistoricoRow[] | null };

          // Converte para AcaoAdiamentoPassada
          const historico: AcaoAdiamentoPassada[] = (historicoRaw ?? []).map((h) => {
            const dt = new Date(h.created_at);
            const ateISO = h.dados?.ateISO ?? h.created_at;
            return {
              criadaEm: h.created_at,
              ateISO,
              tags: tarefa?.tags ?? [],
              projetoId: tarefa?.projeto_id ?? null,
              diaSemana: dt.getDay(),
              horaDia: new Date(ateISO).getHours(),
            };
          });

          const { hora } = decidirHoraDoDia(
            { tags: tarefa?.tags, projeto_id: tarefa?.projeto_id },
            historico,
            agora,
          );

          const saida = calcularProximaAdiada({
            score,
            ef: efAtual,
            adiamentoCount: countAtual,
            prazoConclusao: tarefa?.prazo_conclusao ?? null,
            dataVencimento: tarefa?.data_vencimento ?? null,
            agora,
            horaDoDiaAlvo: hora,
          });

          const { error } = await admin
            .from('tarefas')
            .update({
              adiada_ate: saida.adiadaAte,
              adiamento_count: novoCount,
              ef: saida.novoEf,
              adiamento_motivo_auto: saida.motivo,
            })
            .eq('id', id)
            .eq('usuario_id', usuarioId);
          if (error) throw error;

          await admin.from('historico_acoes').insert({
            usuario_id: usuarioId,
            tarefa_id: id,
            acao: 'adiada_auto',
            dados: {
              ateISO: saida.adiadaAte,
              motivo: saida.motivo,
              ef: saida.novoEf,
              n: novoCount,
              score,
              ...(saida.alertaPrazo ? { alertaPrazo: true } : {}),
            },
          });

          void propagarParaTodoist({
            usuarioId,
            tarefaId: id,
            acao: 'atualizar',
            patch: { dataVencimento: saida.adiadaAte.slice(0, 10) },
          });

          return NextResponse.json({ ok: true, adiadaAte: saida.adiadaAte });
        }
        // --- branch adiada_manual ---
        // adiada_ate vem do input do usuário
        const novoEf = atualizarEfAdiamento(efAtual, score);

        const { error } = await admin
          .from('tarefas')
          .update({
            adiada_ate: body.ate,
            adiamento_count: novoCount,
            ef: novoEf,
            adiamento_motivo_auto: null, // foi manual
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;

        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'adiada_manual',
          dados: {
            ateISO: body.ate,
            ef: novoEf,
            n: novoCount,
            score,
          },
        });

        void propagarParaTodoist({
          usuarioId,
          tarefaId: id,
          acao: 'atualizar',
          patch: { dataVencimento: body.ate.slice(0, 10) },
        });

        return NextResponse.json({ ok: true });
      }

      case 'desfazer_adiamento': {
        const { data: prev } = await admin
          .from('tarefas')
          .select('adiamento_count')
          .eq('id', id)
          .eq('usuario_id', usuarioId)
          .maybeSingle();
        // ef NÃO é revertido — decay assimétrico aceito (spec RN-15)
        const novoCount = Math.max(0, (prev?.adiamento_count ?? 1) - 1);
        const { error } = await admin
          .from('tarefas')
          .update({
            adiada_ate: null,
            adiamento_motivo_auto: null,
            adiamento_count: novoCount,
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'voltada',
          dados: { origem: 'desfazer_adiamento' },
        });
        void propagarParaTodoist({
          usuarioId,
          tarefaId: id,
          acao: 'atualizar',
          patch: { dataVencimento: null },
        });
        return NextResponse.json({ ok: true });
      }

      case 'excluir': {
        const { error } = await admin
          .from('tarefas')
          .update({
            deleted_at: new Date().toISOString(),
            status: 'excluida',
          })
          .eq('id', id)
          .eq('usuario_id', usuarioId);
        if (error) throw error;
        await admin.from('historico_acoes').insert({
          usuario_id: usuarioId,
          tarefa_id: id,
          acao: 'excluida',
        });
        void propagarParaTodoist({ usuarioId, tarefaId: id, acao: 'excluir' });
        return NextResponse.json({ ok: true });
      }
    }
  } catch (err) {
    console.error('/api/tarefas/[id]/acao error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 },
    );
  }
}

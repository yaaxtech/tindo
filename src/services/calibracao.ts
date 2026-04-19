/**
 * Serviço de recalibração — Fase 10.
 * Toda leitura/escrita passa por aqui; componentes não tocam o Supabase diretamente.
 */

import type { ResultadoRecalibracao } from '@/lib/recalibracao/correlacao';
import type { KpiDiario, KpisAgregados, Limiares } from '@/lib/recalibracao/kpis';
import { agregarKpis, detectarGatilhos } from '@/lib/recalibracao/kpis';
import type { GatilhoDetectado } from '@/lib/recalibracao/kpis';
import { getAdminClient, getUsuarioIdMVP } from '@/lib/supabase/admin';

interface ConfigRow {
  peso_urgencia: number;
  peso_importancia: number;
  peso_facilidade: number;
  limiar_recalibracao_reavaliacao: number;
  limiar_recalibracao_descarte: number;
  limiar_recalibracao_adiamento: number;
  ultima_recalibracao_em?: string | null;
  recalibracao_sugerida_em?: string | null;
  recalibracao_motivo?: string | null;
}

export async function buscarKpis30d(usuarioId: string): Promise<KpiDiario[]> {
  const admin = getAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await admin
    .from('kpis_usuario_diario')
    .select('dia, n_mostradas, n_concluidas, n_puladas, n_excluidas, n_adiadas, n_editadas')
    .eq('usuario_id', usuarioId)
    .gte('dia', cutoff.toISOString().slice(0, 10))
    .order('dia', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    dia: String(row.dia),
    nMostradas: Number(row.n_mostradas),
    nConcluidas: Number(row.n_concluidas),
    nPuladas: Number(row.n_puladas),
    nExcluidas: Number(row.n_excluidas),
    nAdiadas: Number(row.n_adiadas),
    nEditadas: Number(row.n_editadas),
  }));
}

export interface ResultadoGatilhos {
  kpis: KpisAgregados;
  gatilhos: GatilhoDetectado[];
  deveRecalibrar: boolean;
  limiares: Limiares;
  ultimaRecalibracaoEm: string | null;
}

export async function verificarGatilhos(): Promise<ResultadoGatilhos> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { data: cfg, error: cfgErr } = await admin
    .from('configuracoes')
    .select(
      'peso_urgencia, peso_importancia, peso_facilidade, ' +
        'limiar_recalibracao_reavaliacao, limiar_recalibracao_descarte, limiar_recalibracao_adiamento, ' +
        'ultima_recalibracao_em',
    )
    .eq('usuario_id', usuarioId)
    .maybeSingle();

  if (cfgErr) throw cfgErr;

  const c = (cfg ?? {}) as ConfigRow;
  const limiares: Limiares = {
    reavaliacao: Number(c.limiar_recalibracao_reavaliacao ?? 30),
    descarte: Number(c.limiar_recalibracao_descarte ?? 25),
    adiamento: Number(c.limiar_recalibracao_adiamento ?? 35),
  };

  const diarios = await buscarKpis30d(usuarioId);
  const kpis = agregarKpis(diarios, 30);
  const { gatilhos, deveRecalibrar } = detectarGatilhos(kpis, limiares);

  return {
    kpis,
    gatilhos,
    deveRecalibrar,
    limiares,
    ultimaRecalibracaoEm: c.ultima_recalibracao_em ?? null,
  };
}

export async function marcarRecalibracaoSugerida(motivo: string): Promise<void> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { error } = await admin
    .from('configuracoes')
    .update({
      recalibracao_sugerida_em: new Date().toISOString(),
      recalibracao_motivo: motivo,
    })
    .eq('usuario_id', usuarioId);

  if (error) throw error;
}

export async function aplicarNovosPesos(pesos: {
  urgencia: number;
  importancia: number;
  facilidade: number;
}): Promise<void> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { error } = await admin
    .from('configuracoes')
    .update({
      peso_urgencia: pesos.urgencia,
      peso_importancia: pesos.importancia,
      peso_facilidade: pesos.facilidade,
      ultima_recalibracao_em: new Date().toISOString(),
      recalibracao_sugerida_em: null,
      recalibracao_motivo: null,
    })
    .eq('usuario_id', usuarioId);

  if (error) throw error;
}

export interface TarefaParaCalibrar {
  id: string;
  titulo: string;
  nota: number;
  importancia: number;
  urgencia: number;
  facilidade: number;
  faixa: 'alta' | 'media' | 'baixa';
}

/**
 * Retorna n tarefas pendentes espalhadas por faixa de nota (alta, média, baixa).
 * Garante diversidade de exemplos para o wizard de recalibração.
 */
export async function obterTarefasParaCalibrar(n = 5): Promise<TarefaParaCalibrar[]> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { data, error } = await admin
    .from('tarefas')
    .select('id, titulo, nota, importancia, urgencia, facilidade')
    .eq('usuario_id', usuarioId)
    .eq('status', 'pendente')
    .is('deleted_at', null)
    .order('nota', { ascending: false })
    .limit(100);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    nota: number | null;
    importancia: number | null;
    urgencia: number | null;
    facilidade: number | null;
  }>;

  if (rows.length === 0) return [];

  // Divide em faixas
  const altas = rows.filter((r) => (r.nota ?? 0) >= 65);
  const medias = rows.filter((r) => (r.nota ?? 0) >= 35 && (r.nota ?? 0) < 65);
  const baixas = rows.filter((r) => (r.nota ?? 0) < 35);

  const porcao = Math.max(1, Math.floor(n / 3));
  const pick = <T>(arr: T[], k: number): T[] => {
    if (arr.length === 0) return [];
    const selected: T[] = [];
    const step = Math.max(1, Math.floor(arr.length / k));
    for (let i = 0; i < k && i * step < arr.length; i++) {
      const item = arr[i * step];
      if (item !== undefined) selected.push(item);
    }
    return selected;
  };

  const selecionadas = [
    ...pick(altas, porcao).map((r) => ({ ...r, faixa: 'alta' as const })),
    ...pick(medias, porcao).map((r) => ({ ...r, faixa: 'media' as const })),
    ...pick(baixas, porcao).map((r) => ({ ...r, faixa: 'baixa' as const })),
  ].slice(0, n);

  // Completa com quaisquer restantes
  if (selecionadas.length < n) {
    const ids = new Set(selecionadas.map((s) => s.id));
    const resto = rows.filter((r) => !ids.has(r.id)).slice(0, n - selecionadas.length);
    for (const r of resto) {
      selecionadas.push({ ...r, faixa: 'media' });
    }
  }

  return selecionadas.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    nota: r.nota ?? 0,
    importancia: r.importancia ?? 50,
    urgencia: r.urgencia ?? 50,
    facilidade: r.facilidade ?? 50,
    faixa: r.faixa,
  }));
}

export async function registrarCalibracao(resultado: ResultadoRecalibracao): Promise<void> {
  const admin = getAdminClient();
  const usuarioId = await getUsuarioIdMVP();

  const { error } = await admin.from('calibracoes').insert({
    usuario_id: usuarioId,
    tipo: 'pesos',
    dados: resultado as unknown as Record<string, unknown>,
    aplicada: true,
    aplicada_em: new Date().toISOString(),
  });

  if (error) throw error;
}

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type KpiAdiamento = {
  /** Percentual 0-100, ou número absoluto (mediana no MAC). */
  valor: number;
  /** N de registros que entraram no cálculo. */
  amostras: number;
  /** Meta fixa por KPI (percentual ou número). */
  meta: number;
  /** Helper: true quando dentro da meta. Neutro (true) se amostras=0. */
  dentroDaMeta: boolean;
};

export type KpisAdiamento = {
  /** Taxa Re-adiamento pós-auto — meta <25%. */
  tra: KpiAdiamento;
  /** Taxa Conclusão pós-auto — meta >50%. */
  tca: KpiAdiamento;
  /** Taxa Expiração — meta <5%. */
  tex: KpiAdiamento;
  /** Mediana adiamentos/concluída — meta ≤3. */
  mac: KpiAdiamento;
  /** % score≥90 com >2 adiamentos — meta ≤2%. */
  sae: KpiAdiamento;
  janelaDias: number;
  calculadoEm: string; // ISO timestamp
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Mediana de um array numérico. Retorna 0 para arrays vazios. */
function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[meio] ?? 0;
  }
  return ((sorted[meio - 1] ?? 0) + (sorted[meio] ?? 0)) / 2;
}

/** Constrói um KpiAdiamento neutro (sem amostras). */
function kpiNeutro(meta: number): KpiAdiamento {
  return { valor: 0, amostras: 0, meta, dentroDaMeta: true };
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * Calcula os 5 KPIs de adiamento espaçado (TRA/TCA/TEX/MAC/SAE)
 * usando janela rolling de `janelaDias` dias (default 30).
 *
 * Nenhuma tabela extra — derivado de `historico_acoes` + `tarefas`.
 * Todo cálculo de mediana em TypeScript (PostgREST não expõe percentile_cont).
 *
 * @param supabase - Client Supabase injetado (browser ou admin, à escolha do caller).
 * @param usuarioId - UUID do usuário dono dos dados.
 * @param janelaDias - Janela rolling em dias (default 30).
 */
export async function calcularKpisAdiamento(
  supabase: SupabaseClient,
  usuarioId: string,
  janelaDias = 30,
): Promise<KpisAdiamento> {
  const agora = new Date();
  const inicioPeriodo = new Date(agora.getTime() - janelaDias * 24 * 60 * 60 * 1000).toISOString();

  // -------------------------------------------------------------------------
  // TRA + TCA — requerem a mesma iteração sobre adiadas_auto
  // -------------------------------------------------------------------------
  //
  // 1. Busca todas as ações `adiada_auto` do usuário na janela.
  // 2. Para cada uma, busca a próxima ação da mesma tarefa após aquele timestamp.
  // 3. TRA: se a próxima ação for adiada_* → re-adiamento.
  //    TCA: se a próxima ação for concluida → conclusão pós-auto.

  const { data: acoesAuto, error: errAuto } = await supabase
    .from('historico_acoes')
    .select('id, tarefa_id, criado_em')
    .eq('usuario_id', usuarioId)
    .eq('acao', 'adiada_auto')
    .gte('criado_em', inicioPeriodo)
    .order('criado_em', { ascending: true });

  if (errAuto) throw errAuto;

  let totalAuto = 0;
  let reAdiamentos = 0;
  let conclusoesPosAuto = 0;

  if (acoesAuto && acoesAuto.length > 0) {
    totalAuto = acoesAuto.length;

    // Para cada adiada_auto, busca próxima ação da mesma tarefa (1 query por item).
    // Limitação conhecida: N queries no loop; aceitável para janelas de 30d (~décadas de dados).
    for (const acaoAuto of acoesAuto) {
      const { data: proxima } = await supabase
        .from('historico_acoes')
        .select('acao')
        .eq('usuario_id', usuarioId)
        .eq('tarefa_id', acaoAuto.tarefa_id)
        .gt('criado_em', acaoAuto.criado_em)
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!proxima) continue;

      if (proxima.acao === 'adiada_auto' || proxima.acao === 'adiada_manual') {
        reAdiamentos++;
      } else if (proxima.acao === 'concluida') {
        conclusoesPosAuto++;
      }
    }
  }

  const tra: KpiAdiamento =
    totalAuto === 0
      ? kpiNeutro(25)
      : {
          valor: (reAdiamentos / totalAuto) * 100,
          amostras: totalAuto,
          meta: 25,
          dentroDaMeta: (reAdiamentos / totalAuto) * 100 < 25,
        };

  const tca: KpiAdiamento =
    totalAuto === 0
      ? kpiNeutro(50)
      : {
          valor: (conclusoesPosAuto / totalAuto) * 100,
          amostras: totalAuto,
          meta: 50,
          dentroDaMeta: (conclusoesPosAuto / totalAuto) * 100 > 50,
        };

  // -------------------------------------------------------------------------
  // TEX — Taxa Expiração
  // Tarefas pendentes com adiada_ate preenchida cujo adiada_ate ultrapassa
  // prazo_conclusao OU data_vencimento.
  // Janela: updated_at >= inicioPeriodo.
  // -------------------------------------------------------------------------

  const { data: tarefasComPrazo, error: errTex } = await supabase
    .from('tarefas')
    .select('id, adiada_ate, prazo_conclusao, data_vencimento')
    .eq('usuario_id', usuarioId)
    .eq('status', 'pendente')
    .not('adiada_ate', 'is', null)
    .gte('updated_at', inicioPeriodo)
    .not('prazo_conclusao', 'is', null); // só conta se tem prazo definido

  if (errTex) throw errTex;

  // Também busca as que têm só data_vencimento (sem prazo_conclusao)
  const { data: tarefasComVencimento, error: errTexVenc } = await supabase
    .from('tarefas')
    .select('id, adiada_ate, prazo_conclusao, data_vencimento')
    .eq('usuario_id', usuarioId)
    .eq('status', 'pendente')
    .not('adiada_ate', 'is', null)
    .gte('updated_at', inicioPeriodo)
    .is('prazo_conclusao', null)
    .not('data_vencimento', 'is', null);

  if (errTexVenc) throw errTexVenc;

  const todasComPrazo = [...(tarefasComPrazo ?? []), ...(tarefasComVencimento ?? [])];
  const totalComPrazo = todasComPrazo.length;
  let expiradas = 0;

  for (const t of todasComPrazo) {
    const adiada = t.adiada_ate ? new Date(t.adiada_ate as string) : null;
    const prazo = t.prazo_conclusao
      ? new Date(t.prazo_conclusao as string)
      : t.data_vencimento
        ? new Date(t.data_vencimento as string)
        : null;

    if (adiada && prazo && adiada > prazo) {
      expiradas++;
    }
  }

  const tex: KpiAdiamento =
    totalComPrazo === 0
      ? kpiNeutro(5)
      : {
          valor: (expiradas / totalComPrazo) * 100,
          amostras: totalComPrazo,
          meta: 5,
          dentroDaMeta: (expiradas / totalComPrazo) * 100 < 5,
        };

  // -------------------------------------------------------------------------
  // MAC — Mediana adiamentos/concluída
  // Tarefas concluídas na janela → extrai adiamento_count → mediana em TS.
  // -------------------------------------------------------------------------

  const { data: concluidasData, error: errMac } = await supabase
    .from('tarefas')
    .select('adiamento_count')
    .eq('usuario_id', usuarioId)
    .eq('status', 'concluida')
    .gte('updated_at', inicioPeriodo);

  if (errMac) throw errMac;

  const contagens = (concluidasData ?? []).map((t) => Number(t.adiamento_count ?? 0));
  const medianaConc = mediana(contagens);

  const mac: KpiAdiamento =
    contagens.length === 0
      ? kpiNeutro(3)
      : {
          valor: medianaConc,
          amostras: contagens.length,
          meta: 3,
          dentroDaMeta: medianaConc <= 3,
        };

  // -------------------------------------------------------------------------
  // SAE — Score-alto-escapando
  // % de tarefas pendentes nota≥90 com adiamento_count>2 sobre total nota≥90.
  // Não filtrado por janela (estado atual do portfólio pendente).
  // -------------------------------------------------------------------------

  // count:'exact' + head:true retorna apenas o header count sem linhas de dados.
  const { count: nTotal, error: errSaeTotal } = await supabase
    .from('tarefas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('status', 'pendente')
    .gte('nota', 90)
    .is('deleted_at', null);

  if (errSaeTotal) throw errSaeTotal;

  const { count: nEscapando, error: errSaeEsc } = await supabase
    .from('tarefas')
    .select('*', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('status', 'pendente')
    .gte('nota', 90)
    .gt('adiamento_count', 2)
    .is('deleted_at', null);

  if (errSaeEsc) throw errSaeEsc;

  const saeTotalN = nTotal ?? 0;
  const saeEscapandoN = nEscapando ?? 0;

  const sae: KpiAdiamento =
    saeTotalN === 0
      ? kpiNeutro(2)
      : {
          valor: (saeEscapandoN / saeTotalN) * 100,
          amostras: saeTotalN,
          meta: 2, // ~0% — usamos ≤2% como limiar operacional
          dentroDaMeta: (saeEscapandoN / saeTotalN) * 100 <= 2,
        };

  return {
    tra,
    tca,
    tex,
    mac,
    sae,
    janelaDias,
    calculadoEm: agora.toISOString(),
  };
}

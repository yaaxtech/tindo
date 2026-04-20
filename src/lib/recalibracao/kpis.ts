/**
 * Agregação e detecção de gatilhos de recalibração a partir de histórico diário.
 * Lib pura — sem efeitos colaterais, sem acesso a banco.
 */

export interface KpiDiario {
  dia: string; // YYYY-MM-DD
  nMostradas: number;
  nConcluidas: number;
  nPuladas: number;
  nExcluidas: number;
  nAdiadas: number;
  nEditadas: number;
}

export interface KpisAgregados {
  /** Rótulo do período, ex: "30d" */
  periodo: string;
  totalMostradas: number;
  /** S01: editadas / mostradas — taxa de reavaliação humana */
  taxaReavaliacao: number;
  /** S02: excluidas / mostradas — taxa de descarte */
  taxaDescarte: number;
  /** S03: adiadas / mostradas — taxa de adiamento */
  taxaAdiar: number;
  /** S04: puladas / mostradas — taxa de pular */
  taxaAvancar: number;
  /** S06: concluidas / dias com atividade — média diária de conclusões */
  concluidasPorDia: number;
  /** taxa de conclusão bruta: concluidas / mostradas */
  taxaConclusao: number;
  /** S07: dias consecutivos com pelo menos 1 conclusão */
  streakMaximo: number;
}

export interface Limiares {
  /** Percentual inteiro, ex: 30 → 30% */
  reavaliacao: number;
  descarte: number;
  adiamento: number;
}

/**
 * Agrega KPIs dos últimos `dias` dias a partir dos registros diários.
 * Aceita array vazio — retorna zeros.
 */
export function agregarKpis(diarios: KpiDiario[], dias = 30): KpisAgregados {
  const hoje = new Date();
  const cutoff = new Date(hoje);
  cutoff.setDate(cutoff.getDate() - dias);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentes = diarios.filter((d) => d.dia >= cutoffStr);

  let totalMostradas = 0;
  let totalConcluidas = 0;
  let totalPuladas = 0;
  let totalExcluidas = 0;
  let totalAdiadas = 0;
  let totalEditadas = 0;
  let diasComAtividade = 0;

  for (const d of recentes) {
    totalMostradas += d.nMostradas;
    totalConcluidas += d.nConcluidas;
    totalPuladas += d.nPuladas;
    totalExcluidas += d.nExcluidas;
    totalAdiadas += d.nAdiadas;
    totalEditadas += d.nEditadas;
    if (d.nMostradas > 0) diasComAtividade++;
  }

  const safe = (num: number, den: number) => (den === 0 ? 0 : num / den);

  // Streak máximo: dias consecutivos com pelo menos 1 conclusão
  // Ordena os dias que têm concluidas
  const diasComConclusao = new Set(recentes.filter((d) => d.nConcluidas > 0).map((d) => d.dia));
  let streakMaximo = 0;
  let streakAtual = 0;
  for (let i = dias; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    if (diasComConclusao.has(dStr)) {
      streakAtual++;
      streakMaximo = Math.max(streakMaximo, streakAtual);
    } else {
      streakAtual = 0;
    }
  }

  return {
    periodo: `${dias}d`,
    totalMostradas,
    taxaReavaliacao: safe(totalEditadas, totalMostradas),
    taxaDescarte: safe(totalExcluidas, totalMostradas),
    taxaAdiar: safe(totalAdiadas, totalMostradas),
    taxaAvancar: safe(totalPuladas, totalMostradas),
    concluidasPorDia: safe(totalConcluidas, diasComAtividade),
    taxaConclusao: safe(totalConcluidas, totalMostradas),
    streakMaximo,
  };
}

export interface GatilhoDetectado {
  codigo: 'reavaliacao' | 'descarte' | 'adiamento';
  label: string;
  valor: number;
  limiar: number;
}

/**
 * Detecta quais KPIs ultrapassaram seus limiares.
 * Limiares em percentual inteiro (ex: 30 = 30%).
 */
export function detectarGatilhos(
  kpis: KpisAgregados,
  lim: Limiares,
): { gatilhos: GatilhoDetectado[]; deveRecalibrar: boolean } {
  const gatilhos: GatilhoDetectado[] = [];

  if (kpis.taxaReavaliacao * 100 > lim.reavaliacao) {
    gatilhos.push({
      codigo: 'reavaliacao',
      label: 'Taxa de reavaliação alta',
      valor: kpis.taxaReavaliacao,
      limiar: lim.reavaliacao / 100,
    });
  }
  if (kpis.taxaDescarte * 100 > lim.descarte) {
    gatilhos.push({
      codigo: 'descarte',
      label: 'Taxa de descarte alta',
      valor: kpis.taxaDescarte,
      limiar: lim.descarte / 100,
    });
  }
  if (kpis.taxaAdiar * 100 > lim.adiamento) {
    gatilhos.push({
      codigo: 'adiamento',
      label: 'Taxa de adiamento alta',
      valor: kpis.taxaAdiar,
      limiar: lim.adiamento / 100,
    });
  }

  return { gatilhos, deveRecalibrar: gatilhos.length > 0 };
}

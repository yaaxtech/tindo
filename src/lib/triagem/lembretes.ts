/**
 * Seção "Lembretes" da /triagem: quais itens são lembretes, se parecem
 * tarefa de verdade, o que sugerir de adiamento e para onde vai cada botão.
 *
 * Funções puras. O cálculo de turno (9h/14h/19h, fuso do dono, RN-13/14) é o
 * mesmo do adiamento por etiqueta (`lib/adiamento/etiquetas.ts`).
 */
import {
  type DestinoAdiamento,
  FUSO_PADRAO,
  HORARIOS_PADRAO,
  calcularDestino,
  diasEntre,
  relogioLocal,
  somarDias,
} from '@/lib/adiamento/etiquetas';

/** Projetos de lembrete no Todoist do dono ("1. Maioli | Lembretes", "⏲Falar ou Ativ. Rapidas"). */
export function ehProjetoDeLembrete(nomeProjeto: string): boolean {
  return /lembrete|falar ou ativ/i.test(nomeProjeto);
}

/**
 * É lembrete quando mora num projeto de lembretes, ou na Entrada já com
 * etiqueta (os lembretes recorrentes que ele deixa na Entrada).
 */
export function ehLembrete(nomeProjeto: string, naEntrada: boolean, etiquetas: string[]): boolean {
  return ehProjetoDeLembrete(nomeProjeto) || (naEntrada && etiquetas.length > 0);
}

const VERBOS_TAREFA =
  /\b(planejar|planejamento|criar|montar|organizar|estudar|implementar|desenvolver|preparar|escrever|elaborar|projetar|construir|instalar|reformar|melhorar|estruturar|revisar|fazer (o|a|um|uma)|resolver)\b/i;
const VERBOS_LEMBRETE =
  /^(ver|falar|ligar|mandar|enviar|perguntar|lembrar|checar|conferir|avisar|pagar|responder|confirmar|marcar|cobrar|botar|comprar)\b/i;

export interface AvaliacaoTipo {
  pareceTarefa: boolean;
  motivo: string;
}

/**
 * Lembrete = coisa de até 2 minutos. Sinais de que é tarefa: verbo de
 * trabalho longo, texto comprido ou descrição com vários passos.
 */
export function avaliarTipo(conteudo: string, descricao: string): AvaliacaoTipo {
  const texto = conteudo.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
  const passos = descricao.split('\n').filter((l) => /^\s*([-*]|\d+[.)])\s+/.test(l)).length;
  if (VERBOS_LEMBRETE.test(texto) && passos < 3) {
    return { pareceTarefa: false, motivo: 'Ação rápida.' };
  }
  const verbo = texto.match(VERBOS_TAREFA)?.[0];
  if (verbo) return { pareceTarefa: true, motivo: `"${verbo}" costuma levar mais de 2 minutos.` };
  if (passos >= 3) return { pareceTarefa: true, motivo: `A descrição tem ${passos} passos.` };
  if (texto.length > 110)
    return { pareceTarefa: true, motivo: 'Texto longo, parece ter várias partes.' };
  return { pareceTarefa: false, motivo: 'Parece ação rápida.' };
}

export interface SituacaoLembrete {
  agora: Date;
  /** `due.date` do Todoist ('YYYY-MM-DD' ou data-hora local). */
  vencimento: string | null;
  recorrente: boolean;
  prioridadeApi: 1 | 2 | 3 | 4;
  prazo?: string | null;
  fuso?: string;
}

export interface SugestaoLembrete {
  texto: string;
  /** Para onde o botão "Aceitar sugestão" mandaria; null = não sugere adiar. */
  destino: DestinoAdiamento | null;
  /** Dias de atraso (0 = em dia ou sem data). */
  atraso: number;
}

/**
 * Sugestão por histórico: atraso longo em item avulso pede recorrência;
 * atraso em recorrente pede espaçar; o resto usa o padrão do `@adiar`.
 */
export function sugerirParaLembrete(s: SituacaoLembrete): SugestaoLembrete {
  const { data: hoje } = relogioLocal(s.agora, s.fuso ?? FUSO_PADRAO);
  const atraso = s.vencimento ? Math.max(0, diasEntre(s.vencimento, hoje)) : 0;
  const adiar = calcularDestino({
    etiqueta: 'adiar',
    agora: s.agora,
    prioridadeApi: s.prioridadeApi,
    prazo: s.prazo ?? null,
    fuso: s.fuso,
  });

  if (!s.vencimento) {
    return { texto: 'Sem data: um lembrete sem data some da vista.', destino: adiar, atraso };
  }
  if (atraso === 0) return { texto: 'Em dia.', destino: null, atraso };
  if (s.recorrente && atraso >= 3) {
    return {
      texto: `Recorrente atrasado há ${atraso} dias: talvez espaçar a recorrência.`,
      destino: adiar,
      atraso,
    };
  }
  if (!s.recorrente && atraso >= 7) {
    return {
      texto: `Atrasado há ${atraso} dias sem recorrência: vale virar recorrente ou excluir.`,
      destino: adiar,
      atraso,
    };
  }
  return {
    texto: `Atrasado ${atraso} dia(s): ${adiar.motivo}.`,
    destino: adiar,
    atraso,
  };
}

export type OpcaoAdiar = 'tarde' | 'noite' | 'amanha' | 'data';

/**
 * Para onde vai cada botão de adiar. `data` = 'YYYY-MM-DD' ou 'DD/MM[/AAAA]',
 * de manhã; nunca antes do próximo turno.
 */
export function destinoDoBotao(
  opcao: OpcaoAdiar,
  agora: Date,
  data?: string,
  fuso = FUSO_PADRAO,
): DestinoAdiamento | null {
  if (opcao !== 'data') {
    return calcularDestino({ etiqueta: opcao, agora, prioridadeApi: 1, fuso });
  }
  const { data: hoje } = relogioLocal(agora, fuso);
  const alvo = lerData(data ?? '', hoje);
  if (!alvo || alvo <= hoje) return null;
  const hh = String(HORARIOS_PADRAO.manha).padStart(2, '0');
  return {
    data: alvo,
    hora: `${hh}:00`,
    dataHoraLocal: `${alvo}T${hh}:00:00`,
    motivo: 'data escolhida',
  };
}

/** Aceita 'YYYY-MM-DD', 'DD/MM' ou 'DD/MM/AAAA'. Sem ano, usa o próximo que ainda não passou. */
export function lerData(texto: string, hoje: string): string | null {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return valida(t);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const dd = m[1]?.padStart(2, '0');
  const mm = m[2]?.padStart(2, '0');
  if (m[3]) {
    const aaaa = m[3].length === 2 ? `20${m[3]}` : m[3];
    return valida(`${aaaa}-${mm}-${dd}`);
  }
  const ano = Number(hoje.slice(0, 4));
  const esteAno = valida(`${ano}-${mm}-${dd}`);
  if (!esteAno) return null;
  return esteAno > hoje ? esteAno : valida(`${ano + 1}-${mm}-${dd}`);
}

function valida(iso: string): string | null {
  return somarDias(iso, 0) === iso ? iso : null;
}

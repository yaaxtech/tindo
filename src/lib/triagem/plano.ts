/**
 * Plano de triagem: a partir da resposta da IA, decide exatamente o que mudar
 * num item da Entrada do Todoist e guarda como ele estava, para desfazer.
 *
 * Função pura — não chama Todoist nem IA. Quem aplica é o serviço de triagem.
 */
import type { Quando, RespostaTriagem } from './prompt';

/** Marca tudo que a IA mexeu com confiança. Ele confirma tirando a etiqueta. */
export const ETIQUETA_IA = 'IA';
/** Marca o que a IA não teve segurança: fica na Entrada para ele olhar. */
export const ETIQUETA_REVISAR = 'IA.revisar';
/** Abaixo disso a IA não move de projeto nem troca etiquetas. */
export const CONFIANCA_MINIMA = 0.75;

/** Prioridade na escala da API do Todoist: 4 = P1 (mais alta), 1 = P4. */
export type PrioridadeApi = 1 | 2 | 3 | 4;

export interface ItemEntrada {
  id: string;
  conteudo: string;
  projetoId: string;
  etiquetas: string[];
  prioridadeApi: PrioridadeApi;
  /** Data/hora que já estava no item (YYYY-MM-DD ou ISO), se houver. */
  vencimento: string | null;
}

export interface EstadoTodoist {
  projetoId: string;
  etiquetas: string[];
  prioridadeApi: PrioridadeApi;
  vencimento: string | null;
}

export interface PlanoTriagem {
  tarefaId: string;
  conteudo: string;
  tipo: 'lembrete' | 'tarefa';
  antes: EstadoTodoist;
  depois: EstadoTodoist;
  /** Turno sugerido; `manter` quando o item já tinha data. */
  quando: Quando | 'manter';
  revisar: boolean;
  confianca: number;
  frenteExistenteId: string | null;
  explicacao: string;
  avisos: string[];
}

export interface ContextoPlano {
  projetosValidos: ReadonlySet<string>;
  /** Etiquetas existentes; a chave é o nome em minúsculas. */
  etiquetasExistentes: ReadonlyMap<string, string>;
  frentesValidas: ReadonlySet<string>;
  confiancaMinima?: number;
}

export function prioridadeVisualParaApi(p: 1 | 2 | 3 | 4): PrioridadeApi {
  return (5 - p) as PrioridadeApi;
}

function ehEtiquetaDaIa(nome: string): boolean {
  const n = nome.toLowerCase();
  return n === ETIQUETA_IA.toLowerCase() || n === ETIQUETA_REVISAR.toLowerCase();
}

function semRepetir(nomes: string[]): string[] {
  const vistos = new Set<string>();
  return nomes.filter((n) => {
    const chave = n.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function montarPlano(
  item: ItemEntrada,
  resposta: RespostaTriagem,
  ctx: ContextoPlano,
): PlanoTriagem {
  const avisos: string[] = [];
  const antes: EstadoTodoist = {
    projetoId: item.projetoId,
    etiquetas: [...item.etiquetas],
    prioridadeApi: item.prioridadeApi,
    vencimento: item.vencimento,
  };

  let projetoId = resposta.projeto_id;
  if (projetoId && !ctx.projetosValidos.has(projetoId)) {
    avisos.push('A IA indicou um projeto que não existe; ficou na Entrada.');
    projetoId = null;
  }

  const etiquetasIa: string[] = [];
  for (const nome of resposta.etiquetas) {
    const existente = ctx.etiquetasExistentes.get(nome.trim().toLowerCase());
    if (!existente) {
      avisos.push(`Etiqueta "${nome}" não existe; ignorada.`);
      continue;
    }
    if (!ehEtiquetaDaIa(existente)) etiquetasIa.push(existente);
  }

  const frenteExistenteId =
    resposta.frente_existente_id && ctx.frentesValidas.has(resposta.frente_existente_id)
      ? resposta.frente_existente_id
      : null;

  const confianca = Math.min(1, Math.max(0, Number(resposta.confianca) || 0));
  const revisar = confianca < (ctx.confiancaMinima ?? CONFIANCA_MINIMA) || projetoId === null;
  const etiquetasDele = item.etiquetas.filter((e) => !ehEtiquetaDaIa(e));
  const quando: PlanoTriagem['quando'] = item.vencimento ? 'manter' : resposta.quando;

  const depois: EstadoTodoist = revisar
    ? {
        ...antes,
        etiquetas: semRepetir([...etiquetasDele, ETIQUETA_REVISAR]),
      }
    : {
        projetoId: projetoId as string,
        etiquetas: semRepetir([...etiquetasDele, ...etiquetasIa, ETIQUETA_IA]),
        prioridadeApi: prioridadeVisualParaApi(resposta.prioridade),
        vencimento: item.vencimento,
      };

  return {
    tarefaId: item.id,
    conteudo: item.conteudo,
    tipo: resposta.tipo,
    antes,
    depois,
    quando: revisar && !item.vencimento ? 'sem_data' : quando,
    revisar,
    confianca,
    frenteExistenteId,
    explicacao: resposta.explicacao.slice(0, 140),
    avisos,
  };
}

/** Item que a triagem deve olhar: ainda não passou pela IA. */
export function precisaTriagem(etiquetas: string[]): boolean {
  return !etiquetas.some(ehEtiquetaDaIa);
}

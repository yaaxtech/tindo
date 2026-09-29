/**
 * Ponte entre o vigia e o TinDo: comentários no próprio item do Todoist.
 *
 * O vigia (rotina do Claude na assinatura do dono) não alcança o banco do
 * TinDo, mas os dois alcançam o Todoist. O vigia deixa a SUGESTÃO como
 * comentário; a página /triagem mostra, o dono edita e o TinDo grava a
 * REVISÃO como outro comentário. Na rodada seguinte o vigia compara os dois.
 *
 * Formato: uma linha de marca, um resumo legível e o JSON num bloco ```json.
 * Função pura — não chama Todoist.
 */

export const MARCA_SUGESTAO = '🤖 Triagem do vigia';
export const MARCA_REVISAO = '✅ Revisado no TinDo';

export type TipoItem = 'lembrete' | 'tarefa';
export type Prioridade = 'P1' | 'P2' | 'P3' | 'P4';

export interface CamposTriagem {
  tipo: TipoItem;
  /** null = fica na Entrada. */
  projetoId: string | null;
  etiquetas: string[];
  prioridade: Prioridade;
  /** Texto livre do turno/data ("amanhã, manhã", "mantém seg 18h"). */
  quando: string;
  /** Ao sair da Entrada para um projeto, fica delegado ao dono. */
  delegar: boolean;
}

export interface SugestaoVigia extends CamposTriagem {
  confianca: number;
  porque: string;
  alerta?: string;
  /** Id da tarefa que o vigia acha que é a mesma coisa (sugere mesclar). */
  duplicadoDe?: string;
}

export interface RevisaoTinDo extends CamposTriagem {
  status: 'aprovado' | 'corrigido';
  nota: string;
}

export type ComentarioTriagem =
  | { tipo: 'sugestao'; dados: SugestaoVigia }
  | { tipo: 'revisao'; dados: RevisaoTinDo };

const PRIORIDADES: readonly Prioridade[] = ['P1', 'P2', 'P3', 'P4'];

function blocoJson(texto: string): unknown {
  const m = texto.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1] ?? '');
  } catch {
    return null;
  }
}

/** Valida os campos editáveis (também o que chega do formulário do TinDo). */
export function lerCampos(raw: Record<string, unknown>): CamposTriagem | null {
  const tipo = raw.tipo === 'lembrete' || raw.tipo === 'tarefa' ? raw.tipo : null;
  const prioridade = PRIORIDADES.includes(raw.prioridade as Prioridade)
    ? (raw.prioridade as Prioridade)
    : null;
  if (!tipo || !prioridade) return null;
  return {
    tipo,
    projetoId: typeof raw.projetoId === 'string' && raw.projetoId ? raw.projetoId : null,
    etiquetas: Array.isArray(raw.etiquetas)
      ? raw.etiquetas.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
      : [],
    prioridade,
    quando: typeof raw.quando === 'string' ? raw.quando : '',
    delegar: raw.delegar === true,
  };
}

/** Reconhece um comentário da triagem; qualquer outro comentário vira null. */
export function lerComentario(texto: string): ComentarioTriagem | null {
  const inicio = texto.trimStart();
  const ehSugestao = inicio.startsWith(MARCA_SUGESTAO);
  const ehRevisao = inicio.startsWith(MARCA_REVISAO);
  if (!ehSugestao && !ehRevisao) return null;
  const raw = blocoJson(texto);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const campos = lerCampos(obj);
  if (!campos) return null;
  if (ehSugestao) {
    const confianca = Number(obj.confianca);
    return {
      tipo: 'sugestao',
      dados: {
        ...campos,
        confianca: Number.isFinite(confianca) ? Math.min(1, Math.max(0, confianca)) : 0,
        porque: typeof obj.porque === 'string' ? obj.porque : '',
        ...(typeof obj.alerta === 'string' && obj.alerta ? { alerta: obj.alerta } : {}),
        ...(typeof obj.duplicadoDe === 'string' && obj.duplicadoDe
          ? { duplicadoDe: obj.duplicadoDe }
          : {}),
      },
    };
  }
  return {
    tipo: 'revisao',
    dados: {
      ...campos,
      status: obj.status === 'corrigido' ? 'corrigido' : 'aprovado',
      nota: typeof obj.nota === 'string' ? obj.nota : '',
    },
  };
}

const CAMPOS: readonly (keyof CamposTriagem)[] = [
  'tipo',
  'projetoId',
  'etiquetas',
  'prioridade',
  'quando',
  'delegar',
];

/** Quais campos o dono mudou em relação à sugestão (etiquetas sem olhar ordem/caixa). */
export function camposAlterados(sugestao: CamposTriagem, final: CamposTriagem): string[] {
  return CAMPOS.filter((k) => {
    if (k === 'etiquetas') {
      const norm = (l: string[]) =>
        l
          .map((e) => e.toLowerCase())
          .sort()
          .join('|');
      return norm(sugestao.etiquetas) !== norm(final.etiquetas);
    }
    if (k === 'quando') return sugestao.quando.trim() !== final.quando.trim();
    return sugestao[k] !== final[k];
  });
}

export function formatarRevisao(
  final: CamposTriagem,
  sugestao: CamposTriagem | null,
  nota: string,
  nomeProjeto: (id: string | null) => string,
): { texto: string; revisao: RevisaoTinDo } {
  const mudou = sugestao ? camposAlterados(sugestao, final) : [];
  const revisao: RevisaoTinDo = {
    ...final,
    status: mudou.length > 0 ? 'corrigido' : 'aprovado',
    nota: nota.trim(),
  };
  const resumo =
    revisao.status === 'aprovado'
      ? 'Sugestão aprovada.'
      : `Corrigido: ${mudou.join(', ')}. Ficou: ${final.tipo}, ${nomeProjeto(final.projetoId)}, ${final.prioridade}.`;
  const linhas = [MARCA_REVISAO, resumo];
  if (revisao.nota) linhas.push(`Motivo: ${revisao.nota}`);
  linhas.push('', '```json', JSON.stringify(revisao), '```');
  return { texto: linhas.join('\n'), revisao };
}

export interface ComentarioBruto {
  tarefaId: string;
  texto: string;
  /** ISO; ordena as rodadas. */
  em: string;
}

export interface EstadoRevisao {
  sugestao: SugestaoVigia;
  /** Revisão feita depois da última sugestão; null = ainda a revisar. */
  revisao: RevisaoTinDo | null;
}

/** Última sugestão de cada tarefa e a revisão que veio depois dela, se houver. */
export function estadoPorTarefa(comentarios: ComentarioBruto[]): Map<string, EstadoRevisao> {
  const ordenados = [...comentarios].sort((a, b) => a.em.localeCompare(b.em));
  const estado = new Map<string, EstadoRevisao>();
  for (const c of ordenados) {
    const lido = lerComentario(c.texto);
    if (!lido) continue;
    if (lido.tipo === 'sugestao') {
      estado.set(c.tarefaId, { sugestao: lido.dados, revisao: null });
    } else {
      const atual = estado.get(c.tarefaId);
      if (atual) atual.revisao = lido.dados;
    }
  }
  return estado;
}

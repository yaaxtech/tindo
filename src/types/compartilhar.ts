// RoadMapMind — Fase 2 (Compartilhamento): tipos de domínio.
// Espelham doc_permissoes / doc_compartilhamento / doc_convites e o guard
// doc_papel_efetivo (snake_case no banco → camelCase aqui).
// Ver spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md

/** Papel concedido a uma pessoa sobre um documento. */
export type Papel = 'leitor' | 'editor';

/** Papel efetivo resolvido pelo guard: inclui 'dono' e null (sem acesso). */
export type PapelEfetivo = Papel | 'dono' | null;

/** Modo do link do documento (estilo Google Drive). */
export type ModoLink = 'restrito' | 'publico_leitura';

/** Status de um convite pendente por email. */
export type StatusConvite = 'pendente' | 'aceito' | 'revogado';

/** Grant de acesso de uma pessoa a um documento-raiz. */
export interface Permissao {
  id: string;
  documentoId: string; // linha-raiz do doc (título + subárvore)
  usuarioId: string; // quem recebe o acesso
  papel: Papel;
  criadoPor: string; // dono que compartilhou
}

/** Configuração de link/visibilidade de um documento. */
export interface Compartilhamento {
  documentoId: string;
  modoLink: ModoLink;
  linkToken: string; // uuid não-adivinhável usado na URL pública
}

/** Convite pendente por email (vira Permissao ao a pessoa cadastrar). */
export interface Convite {
  id: string;
  documentoId: string;
  email: string; // sempre lower(trim(email))
  papel: Papel;
  status: StatusConvite;
}

/** Item de "Compartilhados comigo" (retorno da RPC listar_compartilhados_comigo). */
export interface CompartilhadoComigo {
  documentoId: string;
  tituloMd: string;
  papel: Papel;
  dono: string; // usuario_id do dono do documento
}

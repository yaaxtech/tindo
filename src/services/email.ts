// RoadMapMind — Fase 2 (Compartilhamento): envio de email de convite.
// O Cloudflare Worker bloqueia SMTP (portas 25/465/587) — todo envio é por
// fetch() ao endpoint REST do Resend, nunca SMTP.
// Ver spec: docs/superpowers/plans/2026-08-02-roadmapmind-fase-2-compartilhamento.md

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Placeholder sender until the dono verifies a custom domain in Resend (DNS,
// pré-requisito da Fatia 3). Overridable via RESEND_FROM.
const REMETENTE_PADRAO = 'RoadMapMind <convites@tindoapp.pages.dev>';

/** Dados para montar e enviar o email de convite de compartilhamento. */
export interface DadosConviteEmail {
  para: string;
  nomeDono: string;
  tituloDoc: string;
  url: string;
  /** true = pessoa já tem conta TinDo (link do doc); false = convite de cadastro. */
  temConta: boolean;
}

function escapeHtml(texto: string): string {
  const mapa: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return texto.replace(/[&<>"']/g, (c) => mapa[c] ?? c);
}

function assuntoDoConvite(nomeDono: string): string {
  return `${nomeDono} compartilhou um documento com você`;
}

function corpoHtmlDoConvite(dados: DadosConviteEmail): string {
  const nomeDono = escapeHtml(dados.nomeDono);
  const titulo = escapeHtml(dados.tituloDoc.trim() || 'Documento sem título');
  const chamada = dados.temConta ? 'Abrir documento' : 'Criar conta e ver o documento';
  return `
    <div style="font-family: -apple-system, sans-serif; color: #1B222C; line-height: 1.5;">
      <p><strong>${nomeDono}</strong> compartilhou o documento <strong>"${titulo}"</strong> com você no RoadMapMind (TinDo).</p>
      <p>
        <a href="${dados.url}" style="display:inline-block;background:#198B74;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
          ${chamada}
        </a>
      </p>
      <p style="color:#7A8796;font-size:12px;">Se você não esperava este email, pode ignorá-lo.</p>
    </div>
  `.trim();
}

/**
 * Envia o email de convite via Resend REST (fetch, nunca SMTP).
 *
 * Fica DESLIGADO por padrão (`EMAIL_ENVIO_ATIVO` default false) até o dono
 * verificar o domínio no Resend e cadastrar `RESEND_API_KEY`. Desligado, ou
 * sem chave configurada, a função retorna sem chamar `fetch` e sem lançar —
 * o convite pendente (gravado em `doc_convites`) continua funcionando, só o
 * envio de email fica pendente.
 */
export async function enviarEmailConvite(dados: DadosConviteEmail): Promise<void> {
  const envioAtivo = process.env.EMAIL_ENVIO_ATIVO === 'true';
  const apiKey = process.env.RESEND_API_KEY;
  if (!envioAtivo || !apiKey) return;

  const from = process.env.RESEND_FROM || REMETENTE_PADRAO;

  const resposta = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: dados.para,
      subject: assuntoDoConvite(dados.nomeDono),
      html: corpoHtmlDoConvite(dados),
    }),
  });

  if (!resposta.ok) {
    throw new Error('Não foi possível enviar o email de convite.');
  }
}

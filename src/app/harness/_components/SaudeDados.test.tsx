import type { FontesHarness } from '@/app/harness/_components/useDadosHarness';
import type { HarnessBlob } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SaudeDados } from './SaudeDados';

const dados: HarnessBlob = {
  schema_version: 2,
  metric_version: 'construction-v2-2026-08-27',
  gerado_em: '2026-09-09T12:00:00Z',
  as_of: '2026-09-09T12:00:00Z',
  ledger: [],
  metricas_periodos: {},
  saude_dados: {
    schema_version: 2,
    metric_version: 'construction-v2-2026-08-27',
    gerado_em: '2026-09-09T12:00:00Z',
    source_max_ts: '2026-09-09T11:00:00Z',
    atraso_fonte_seg: 3600,
    eventos_recebidos: 12,
    eventos_publicados: 10,
    eventos_rejeitados: 2,
    rejeicoes_por_motivo: { papel_ausente: 2 },
    papel_explicito: 8,
    papel_explicito_pct: 0.8,
    duracao_preenchida: 3,
    duracao_preenchida_pct: 0.3,
  },
  history: [],
  volume_codigo: [],
  prs: [],
  assinaturas: [],
  cadeias: {},
};

const fontes: FontesHarness = {
  snapshot: {
    estado: 'fresco',
    origem: 'snapshot',
    mensagem: null,
    atualizadoEm: '2026-09-09T12:00:00Z',
    velho: false,
  },
  githubRuns: {
    estado: 'anterior',
    origem: 'harness/github_runs',
    mensagem: 'timeout',
    atualizadoEm: '2026-08-28T10:00:00Z',
    velho: true,
  },
  minutos: {
    estado: 'vazio',
    origem: 'minutos do GitHub',
    mensagem: null,
    atualizadoEm: null,
    velho: false,
  },
  alertas: {
    estado: 'fresco',
    origem: 'alertas',
    mensagem: null,
    atualizadoEm: '2026-09-09T06:00:00Z',
    velho: false,
  },
};

describe('SaudeDados', () => {
  it('mostra motivos de rejeição, coberturas e origem de fonte com erro', () => {
    render(<SaudeDados dados={dados} contratoValido fontes={fontes} />);

    expect(screen.getByText(/2 recebidos · 10 publicados · 2 rejeitados/)).toBeInTheDocument();
    expect(screen.getByText('sem papel')).toBeInTheDocument();
    expect(screen.getByText('Papéis carimbados')).toBeInTheDocument();
    expect(screen.getByText('Duração total registrada')).toBeInTheDocument();
    expect(screen.getByText(/leitura anterior mantida · fonte velha/)).toBeInTheDocument();
    expect(screen.getByText(/origem: harness\/github_runs/)).toBeInTheDocument();
  });
});

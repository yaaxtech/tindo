import type { HarnessBlob, HarnessSnapshot, LedgerLinha } from '@/types/harness';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Snapshot fora do contrato com ledger NÃO vazio: a página não pode dizer
// "0 despachos" como se fosse dado real, nem esconder o único aviso dentro
// do diagnóstico fechado. Os blocos pesados viram stubs — o que se testa
// aqui é a página, não eles.

const hook = vi.hoisted(() => ({ useDadosHarness: vi.fn() }));
vi.mock('@/app/harness/_components/useDadosHarness', () => hook);

const { stub } = vi.hoisted(() => ({
  stub: (nome: string) => () => <div data-testid={`stub-${nome}`} />,
}));
vi.mock('@/app/harness/_components/Tiles', () => ({ Tiles: stub('tiles') }));
vi.mock('@/app/harness/_components/PlacarValor', () => ({ PlacarValor: stub('placar') }));
vi.mock('@/app/harness/_components/Terrenos', () => ({ Terrenos: stub('terrenos') }));
vi.mock('@/app/harness/_components/Assinaturas', () => ({ Assinaturas: stub('assinaturas') }));
vi.mock('@/app/harness/_components/FaixaAlertas', () => ({ FaixaAlertas: stub('faixa') }));
vi.mock('@/app/harness/_components/NavPainel', () => ({ NavPainel: stub('nav') }));
vi.mock('@/app/harness/_components/SaudeDados', () => ({ SaudeDados: stub('saude') }));
vi.mock('@/app/harness/_components/Janela', () => ({ Janela: stub('janela') }));
vi.mock('@/app/harness/_components/Revisao', () => ({ Revisao: stub('revisao') }));
vi.mock('@/app/harness/_components/TemposDespacho', () => ({ TemposDespacho: stub('td') }));
vi.mock('@/app/harness/_components/TemposGithub', () => ({ TemposGithub: stub('tg') }));
vi.mock('@/app/harness/_components/FluxoGithub', () => ({ FluxoGithub: stub('fluxo') }));
vi.mock('@/app/harness/_components/MinutosGithub', () => ({ MinutosGithub: stub('min') }));
vi.mock('@/app/harness/_components/Modelos', () => ({ Modelos: stub('modelos') }));
vi.mock('@/app/harness/_components/VolumeHistorico', () => ({
  VolumeCodigo: stub('volume'),
  Historico: stub('historico'),
}));

import HarnessPage from '@/app/harness/page';

const AS_OF = '2026-09-07T12:00:00.000Z';

function linha(ts: string): LedgerLinha {
  return {
    ts,
    frente: 'codex',
    modelo: 'sol',
    effort: 'high',
    terreno: 'rotina',
    resultado: 'ok1',
    dur: 5,
  } as LedgerLinha;
}

/** Blob com registros de verdade, mas schema antigo: contrato falha de cara. */
function snapshotIncompativel(): HarnessSnapshot {
  const dados: HarnessBlob = {
    schema_version: 1,
    gerado_em: AS_OF,
    as_of: AS_OF,
    ledger: [linha('2026-09-07T10:00:00.000Z'), linha('2026-09-06T10:00:00.000Z')],
    history: [],
    volume_codigo: [],
    prs: [],
    assinaturas: [
      { nome: 'Codex', frente: 'codex', valor: 30, renova: '2026-10-01', papel: 'construtor' },
    ],
    cadeias: {},
  };
  return { dados, geradoEm: AS_OF };
}

beforeEach(() => {
  vi.useFakeTimers({ now: Date.parse(AS_OF) + 5 * 60e3, toFake: ['Date'] });
  hook.useDadosHarness.mockReturnValue({
    snap: snapshotIncompativel(),
    githubRuns: [],
    actionsSnapshot: null,
    alertas: undefined,
    carregando: false,
    erro: null,
    atualizar: vi.fn(),
  });
});

describe('HarnessPage com snapshot incompatível e ledger não vazio', () => {
  it('mostra o aviso sempre visível, fora do diagnóstico fechado', () => {
    render(<HarnessPage />);
    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent(/snapshot incompatível/i);
    expect(alerta).toBeVisible();
    expect(alerta.closest('details')).toBeNull();
  });

  it('cabeçalho diz que a leitura está suspensa, não "0 despachos"', () => {
    render(<HarnessPage />);
    expect(screen.getByText(/Leitura incompatível — indicadores suspensos/)).toBeInTheDocument();
    expect(screen.queryByText(/0 despachos/)).toBeNull();
    expect(screen.queryByText(/KPIs dos últimos/)).toBeNull();
  });

  it('não pinta Como estamos, Placar nem Assinaturas como dado real', () => {
    render(<HarnessPage />);
    expect(screen.queryByTestId('stub-tiles')).toBeNull();
    expect(screen.queryByTestId('stub-placar')).toBeNull();
    expect(screen.queryByTestId('stub-assinaturas')).toBeNull();
    expect(screen.getAllByText(/^Indicadores indisponíveis:/)).toHaveLength(2);
    // Configuração declarada continua, com a ressalva de sinal suspenso.
    expect(screen.getByTestId('stub-terrenos')).toBeInTheDocument();
    expect(screen.getByText(/Só a configuração declarada/)).toBeInTheDocument();
  });
});

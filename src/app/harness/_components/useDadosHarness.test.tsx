import type { HarnessSnapshot } from '@/types/harness';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const servicos = vi.hoisted(() => ({
  getHarnessSnapshot: vi.fn(),
  getGithubRuns: vi.fn(),
  getActionsSnapshot: vi.fn(),
  getHarnessAlertas: vi.fn(),
}));
vi.mock('@/services/harness', () => servicos);

import { ERRO_ATUALIZACAO, ERRO_CARGA_INICIAL, useDadosHarness } from './useDadosHarness';

const snapshot = (geradoEm: string): HarnessSnapshot =>
  ({ geradoEm, dados: { gerado_em: geradoEm } }) as unknown as HarnessSnapshot;

const erroSupabase = () => new Error('harness/x: permission denied');

beforeEach(() => {
  vi.resetAllMocks();
  servicos.getGithubRuns.mockResolvedValue([]);
  servicos.getActionsSnapshot.mockResolvedValue(null);
  servicos.getHarnessAlertas.mockResolvedValue({ avaliacoes: [], alertas: [] });
});

async function montarCarregado() {
  const r = renderHook(() => useDadosHarness());
  await waitFor(() => expect(r.result.current.carregando).toBe(false));
  return r;
}

describe('useDadosHarness', () => {
  it('carrega as fontes ao montar e some o "carregando" quando termina', async () => {
    servicos.getHarnessSnapshot.mockResolvedValue(snapshot('2026-09-07T10:00:00Z'));
    const { result } = renderHook(() => useDadosHarness());
    expect(result.current.carregando).toBe(true);

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.snap?.geradoEm).toBe('2026-09-07T10:00:00Z');
    expect(result.current.erro).toBeNull();
    expect(result.current.fontes.snapshot.estado).toBe('fresco');
    expect(result.current.fontes.githubRuns.estado).toBe('vazio');
    expect(result.current.fontes.minutos.estado).toBe('vazio');
    expect(result.current.fontes.alertas.estado).toBe('vazio');
  });

  it('Atualizar busca tudo de novo e troca o snapshot pelo mais recente', async () => {
    servicos.getHarnessSnapshot
      .mockResolvedValueOnce(snapshot('2026-09-07T10:00:00Z'))
      .mockResolvedValueOnce(snapshot('2026-09-07T11:00:00Z'));
    const { result } = await montarCarregado();

    await act(() => result.current.atualizar());

    expect(servicos.getHarnessSnapshot).toHaveBeenCalledTimes(2);
    expect(servicos.getGithubRuns).toHaveBeenCalledTimes(2);
    expect(result.current.snap?.geradoEm).toBe('2026-09-07T11:00:00Z');
    expect(result.current.erro).toBeNull();
  });

  it('snapshot rejeitado na atualização mantém o anterior e avisa', async () => {
    servicos.getHarnessSnapshot
      .mockResolvedValueOnce(snapshot('2026-09-07T10:00:00Z'))
      .mockRejectedValueOnce(erroSupabase());
    const { result } = await montarCarregado();

    await act(() => result.current.atualizar());

    expect(result.current.snap?.geradoEm).toBe('2026-09-07T10:00:00Z');
    expect(result.current.erro).toBe(ERRO_ATUALIZACAO);
    expect(result.current.carregando).toBe(false);
    expect(result.current.fontes.snapshot.estado).toBe('anterior');
    expect(result.current.fontes.snapshot.origem).toBe('harness/x');
    expect(result.current.fontes.snapshot.mensagem).toContain('permission denied');
  });

  it('erro do Supabase nas fontes auxiliares preserva as quatro leituras anteriores e avisa', async () => {
    const runs = [{ run_id: 1 }];
    const actions = { dados: {}, geradoEm: '2026-09-07T09:00:00Z' };
    const alertas = { avaliacoes: [{ id: 'a1' }], alertas: [] };
    servicos.getHarnessSnapshot.mockResolvedValue(snapshot('2026-09-07T10:00:00Z'));
    servicos.getGithubRuns.mockResolvedValueOnce(runs).mockRejectedValueOnce(erroSupabase());
    servicos.getActionsSnapshot
      .mockResolvedValueOnce(actions)
      .mockRejectedValueOnce(erroSupabase());
    servicos.getHarnessAlertas.mockResolvedValueOnce(alertas).mockRejectedValueOnce(erroSupabase());
    const { result } = await montarCarregado();

    await act(() => result.current.atualizar());

    expect(result.current.snap?.geradoEm).toBe('2026-09-07T10:00:00Z');
    expect(result.current.githubRuns).toBe(runs);
    expect(result.current.actionsSnapshot).toBe(actions);
    expect(result.current.alertas).toBe(alertas);
    expect(result.current.erro).toBe(ERRO_ATUALIZACAO);
    expect(result.current.fontes.githubRuns.estado).toBe('anterior');
    expect(result.current.fontes.githubRuns.origem).toBe('harness/x');
    expect(result.current.fontes.minutos.estado).toBe('anterior');
    expect(result.current.fontes.alertas.estado).toBe('anterior');
  });

  it('retorno vazio legítimo (sem erro) substitui a leitura anterior, sem aviso', async () => {
    const vazio = { avaliacoes: [], alertas: [] };
    servicos.getHarnessSnapshot
      .mockResolvedValueOnce(snapshot('2026-09-07T10:00:00Z'))
      .mockResolvedValueOnce(null);
    servicos.getGithubRuns.mockResolvedValueOnce([{ run_id: 1 }]).mockResolvedValueOnce([]);
    servicos.getActionsSnapshot
      .mockResolvedValueOnce({ dados: {}, geradoEm: 't' })
      .mockResolvedValueOnce(null);
    servicos.getHarnessAlertas
      .mockResolvedValueOnce({ avaliacoes: [{ id: 'a1' }], alertas: [] })
      .mockResolvedValueOnce(vazio);
    const { result } = await montarCarregado();

    await act(() => result.current.atualizar());

    expect(result.current.snap).toBeNull();
    expect(result.current.githubRuns).toEqual([]);
    expect(result.current.actionsSnapshot).toBeNull();
    expect(result.current.alertas).toBe(vazio);
    expect(result.current.erro).toBeNull();
    expect(result.current.fontes.snapshot.estado).toBe('vazio');
    expect(result.current.fontes.githubRuns.estado).toBe('vazio');
    expect(result.current.fontes.minutos.estado).toBe('vazio');
    expect(result.current.fontes.alertas.estado).toBe('vazio');
  });

  it('null na primeira carga é "ainda sem dados", sem erro', async () => {
    servicos.getHarnessSnapshot.mockResolvedValue(null);
    const { result } = await montarCarregado();
    expect(result.current.snap).toBeNull();
    expect(result.current.erro).toBeNull();
  });

  it('snapshot rejeitado na primeira carga avisa que não há leitura, não "números abaixo"', async () => {
    servicos.getHarnessSnapshot.mockRejectedValue(erroSupabase());
    const { result } = await montarCarregado();
    expect(result.current.snap).toBeNull();
    expect(result.current.erro).toBe(ERRO_CARGA_INICIAL);
    expect(result.current.fontes.snapshot.estado).toBe('erro');
    expect(result.current.fontes.snapshot.origem).toBe('harness/x');
  });

  it('marca GitHub runs sem carimbo como fonte velha, sem depender do snapshot principal', async () => {
    servicos.getHarnessSnapshot.mockResolvedValue(
      snapshot(new Date(Date.now() - 30 * 60e3).toISOString()),
    );
    servicos.getGithubRuns.mockResolvedValue([{ run_id: 1, coletado_em: '2026-08-28T10:00:00Z' }]);
    const { result } = await montarCarregado();
    expect(result.current.fontes.snapshot.velho).toBe(false);
    expect(result.current.fontes.githubRuns.velho).toBe(true);
    expect(result.current.fontes.githubRuns.atualizadoEm).toBe('2026-08-28T10:00:00Z');
  });
});

/** One-time, pure conversion. The caller owns backup and persistence. */
export function unificarRotas(config) {
  const next = structuredClone(config);
  if (!next.terrenos || !Object.keys(next.terrenos).length) throw new Error('Terrenos ausentes');
  for (const [terreno, rota] of Object.entries(next.terrenos)) {
    const legado = next.codex?.terrenos?.[terreno];
    if (!rota.experimento && legado?.experimento) rota.experimento = legado.experimento;
    if (legado?.revisao_por_modelo) {
      rota.revisao_por_modelo = { ...legado.revisao_por_modelo, ...rota.revisao_por_modelo };
    }
    const porMotivo = rota.fallback_por_motivo ?? {};
    const anthropic = porMotivo.quota_openai ?? porMotivo.qualidade_ou_quota_openai;
    const openai =
      porMotivo.quota_anthropic ??
      porMotivo.qualidade_ou_quota_anthropic ??
      porMotivo.opus_indisponivel;
    // The old cross-provider counterpart is retained, with the canonical
    // author used when that provider already owns the terrain.
    const titularClaude = /^(opus|fable|sonnet|haiku)/.test(rota.modelo);
    const titular = [{ modelo: rota.modelo, effort: rota.effort }];
    const alternativaClaude = titularClaude
      ? titular
      : (anthropic ?? legado?.fallback_por_motivo?.quota_openai);
    const alternativaCodex = titularClaude ? openai : titular;
    if (!alternativaClaude?.length || !alternativaCodex?.length) {
      throw new Error(`Fallback entre provedores ausente em ${terreno}`);
    }
    const qualidade =
      porMotivo.qualidade ??
      porMotivo.qualidade_ou_quota_openai ??
      porMotivo.qualidade_ou_quota_anthropic;
    rota.fallback_por_motivo = {
      ...(qualidade ? { qualidade } : {}),
      quota_openai: alternativaClaude,
      indisponivel_openai: alternativaClaude,
      quota_anthropic: alternativaCodex,
      indisponivel_anthropic: alternativaCodex,
    };
    // biome-ignore lint/performance/noDelete: remove a obsolete persisted routing key, not a hot-path object field
    delete rota.braco_experimental_xhigh;
  }
  if (next.codex) {
    // biome-ignore lint/performance/noDelete: the legacy persisted route must be absent after conversion
    delete next.codex.terrenos;
  }
  next._meta = { ...next._meta, rota_unica: true };
  return next;
}

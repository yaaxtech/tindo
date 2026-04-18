import { clamp } from '@/lib/utils';

/**
 * Cor de urgência derivada da nota 0-100.
 *
 * Filosofia: nota baixa = cinza frio (neutro, sem pressão).
 * Nota 30+ começa em âmbar dourado e caminha em direção a vermelho puro
 * em 100. A escala evita passar por verde (jade é cor semântica de OK no
 * projeto, reservada pra conclusão).
 *
 * Retorna três derivações: borda sólida, glow translúcido, intensidade 0-1.
 */
export interface CorUrgencia {
  borderColor: string;
  glow: string;
  ring: string;
  intensity: number;
  hue: number;
}

export function corUrgencia(nota: number): CorUrgencia {
  const n = clamp(nota, 0, 100);

  // Notas baixas (0-29): cinza frio, glow zero.
  if (n < 30) {
    const intensity = n / 30;
    return {
      borderColor: `hsl(220, 8%, ${28 + intensity * 8}%)`,
      glow: 'transparent',
      ring: 'rgba(232, 237, 242, 0.08)',
      intensity: 0,
      hue: 220,
    };
  }

  // Faixa ativa (30-100): interpolação contínua âmbar → vermelho.
  const t = (n - 30) / 70; // 0..1
  const hueRaw = 50 - t * 55; // 50 → -5 (passa por 0 = vermelho puro)
  const hue = hueRaw < 0 ? 360 + hueRaw : hueRaw;
  const sat = 60 + t * 30; // 60 → 90
  const light = 55 - t * 8; // 55 → 47
  const glowAlpha = 0.15 + t * 0.45;
  const ringAlpha = 0.2 + t * 0.35;

  return {
    borderColor: `hsl(${hue}, ${sat}%, ${light}%)`,
    glow: `hsla(${hue}, ${sat}%, ${light}%, ${glowAlpha})`,
    ring: `hsla(${hue}, ${sat}%, ${light}%, ${ringAlpha})`,
    intensity: t,
    hue,
  };
}

/**
 * Retorna só a cor textual (hex/hsl) apropriada pra uso em text-color.
 * Nota baixa = text-muted; conforme sobe, vira a cor de urgência.
 */
export function corUrgenciaTexto(nota: number): string {
  const { borderColor, intensity } = corUrgencia(nota);
  if (intensity < 0.15) return 'var(--text-secondary)';
  return borderColor;
}

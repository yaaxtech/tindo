'use client';

/**
 * Síntese sonora via Tone.js (neurociência da recompensa).
 * Lazy-init: Tone só carrega na primeira chamada (política de autoplay).
 */

let inicializado = false;
let sintetizadorRef: unknown = null;
let arpejoRef: unknown = null;
let fanfareRef: unknown = null;

async function init() {
  if (inicializado) return;
  const Tone = await import('tone');
  await Tone.start();

  const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.22 }).toDestination();
  const sintetizador = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.004, decay: 0.28, sustain: 0.12, release: 0.55 },
  }).connect(reverb);
  const arpejo = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.2, sustain: 0.05, release: 0.3 },
  }).connect(reverb);
  const fanfare = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.008, decay: 0.4, sustain: 0.18, release: 0.8 },
  }).connect(reverb);

  sintetizadorRef = sintetizador;
  arpejoRef = arpejo;
  fanfareRef = fanfare;
  inicializado = true;
}

const FUNDAMENTAIS = ['C4', 'D4', 'E4', 'F4', 'G4'] as const;

export async function playCompletion(comStreak = false): Promise<void> {
  try {
    await init();
    const Tone = await import('tone');
    const synth = sintetizadorRef as InstanceType<typeof Tone.PolySynth>;
    const fundamental = FUNDAMENTAIS[Math.floor(Math.random() * FUNDAMENTAIS.length)] ?? 'C4';
    const terca = Tone.Frequency(fundamental).transpose(4).toNote();
    const quinta = Tone.Frequency(fundamental).transpose(7).toNote();
    const notas: string[] = [fundamental, terca, quinta];
    if (comStreak) notas.push(Tone.Frequency(fundamental).transpose(12).toNote());
    synth.triggerAttackRelease(notas, '8n');
  } catch {
    /* silenciosamente falha (audio não disponível) */
  }
}

export async function playLevelUp(): Promise<void> {
  try {
    await init();
    const Tone = await import('tone');
    const arpejo = arpejoRef as InstanceType<typeof Tone.Synth>;
    const notas = ['C4', 'E4', 'G4', 'C5'];
    const now = Tone.now();
    notas.forEach((nota, i) => {
      arpejo.triggerAttackRelease(nota, '16n', now + i * 0.09);
    });
  } catch {
    /* silenciosamente falha */
  }
}

export async function playConquista(): Promise<void> {
  try {
    await init();
    const Tone = await import('tone');
    const fanfare = fanfareRef as InstanceType<typeof Tone.PolySynth>;
    const now = Tone.now();
    fanfare.triggerAttackRelease(['C4', 'E4', 'G4'], '8n', now);
    fanfare.triggerAttackRelease(['C5', 'E5', 'G5'], '4n', now + 0.18);
  } catch {
    /* silenciosamente falha */
  }
}

export async function playSwipe(direcao: 'up' | 'down' | 'left' | 'right'): Promise<void> {
  try {
    await init();
    const Tone = await import('tone');
    const synth = sintetizadorRef as InstanceType<typeof Tone.PolySynth>;
    const notaMap: Record<typeof direcao, string> = {
      left: 'A3',
      right: 'D4',
      up: 'G4',
      down: 'E3',
    };
    synth.triggerAttackRelease(notaMap[direcao], '64n', undefined, 0.35);
  } catch {
    /* silenciosamente falha */
  }
}

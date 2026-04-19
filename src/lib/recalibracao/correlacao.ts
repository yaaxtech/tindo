/**
 * Regressão linear OLS sobre z-scores para recalibrar pesos de scoring.
 * Lib pura — sem efeitos colaterais.
 *
 * Modelo: notaHumana ≈ w_urg * U_z + w_imp * I_z + w_fac * F_z
 * Minimiza MSE via gradiente analítico (OLS closed-form).
 * Normaliza pesos resultantes para soma = 1, clamp em [0.1, 0.8].
 */

export interface AmostraCalibracao {
  importancia: number; // 0-100 do sistema
  urgencia: number;    // 0-100 do sistema
  facilidade: number;  // 0-100 do sistema
  notaHumana: number;  // 0-100 dada pelo usuário no slider
  notaAtual: number;   // nota calculada antes da recalibração
}

export interface ResultadoRecalibracao {
  pesosNovos: { urgencia: number; importancia: number; facilidade: number };
  correlacaoAntes: number;
  correlacaoDepois: number;
  amostras: number;
}

/** Pearson correlation between two arrays (same length, n >= 2). */
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] ?? 0) - mx;
    const dy = (ys[i] ?? 0) - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

/** Normaliza array para média 0 e desvio padrão 1. */
function zScore(arr: number[]): number[] {
  const n = arr.length;
  const mean = arr.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / n) || 1;
  return arr.map((x) => (x - mean) / std);
}

/**
 * OLS 3-variáveis sem intercepto (features já z-scored).
 * Resolve X'X w = X'y via direct 3x3 inversion (closed form).
 * Retorna pesos brutos (pode ser negativo antes do clamp).
 */
function olsSem3(
  U: number[],
  I: number[],
  F: number[],
  y: number[],
): [number, number, number] {
  const n = U.length;
  // Normal equations: [X'X] * w = X'y
  // X'X é 3x3
  let uu = 0, ui = 0, uf = 0, ii = 0, if_ = 0, ff = 0;
  let uy = 0, iy = 0, fy = 0;
  for (let k = 0; k < n; k++) {
    const uk = U[k] ?? 0, ik = I[k] ?? 0, fk = F[k] ?? 0, yk = y[k] ?? 0;
    uu += uk * uk; ui += uk * ik; uf += uk * fk;
                   ii += ik * ik; if_ += ik * fk;
                                  ff += fk * fk;
    uy += uk * yk; iy += ik * yk; fy += fk * yk;
  }
  // Cramer / determinante 3x3
  // | uu ui uf |
  // | ui ii if |
  // | uf if ff |
  const det =
    uu * (ii * ff - if_ * if_) -
    ui * (ui * ff - if_ * uf) +
    uf * (ui * if_ - ii * uf);

  if (Math.abs(det) < 1e-12) {
    // Singular — fallback uniform
    return [1 / 3, 1 / 3, 1 / 3];
  }

  const w0 =
    (uy * (ii * ff - if_ * if_) -
      ui * (iy * ff - if_ * fy) +
      uf * (iy * if_ - ii * fy)) /
    det;
  const w1 =
    (uu * (iy * ff - if_ * fy) -
      uy * (ui * ff - if_ * uf) +
      uf * (ui * fy - iy * uf)) /
    det;
  const w2 =
    (uu * (ii * fy - iy * if_) -
      ui * (ui * fy - iy * uf) +
      uy * (ui * if_ - ii * uf)) /
    det;

  return [w0, w1, w2];
}

/**
 * Calcula novos pesos a partir das amostras de calibração.
 * Exige pelo menos 2 amostras; com < 2 retorna pesosAtuais inalterados.
 */
export function calcularNovosPesos(
  amostras: AmostraCalibracao[],
  pesosAtuais: { urgencia: number; importancia: number; facilidade: number },
): ResultadoRecalibracao {
  const n = amostras.length;

  // Correlação antes: pearson(notaAtual, notaHumana)
  const notasAtuais = amostras.map((a) => a.notaAtual);
  const notasHumanas = amostras.map((a) => a.notaHumana);
  const correlacaoAntes = pearson(notasAtuais, notasHumanas);

  if (n < 2) {
    return {
      pesosNovos: { ...pesosAtuais },
      correlacaoAntes,
      correlacaoDepois: correlacaoAntes,
      amostras: n,
    };
  }

  const Us = zScore(amostras.map((a) => a.urgencia));
  const Is = zScore(amostras.map((a) => a.importancia));
  const Fs = zScore(amostras.map((a) => a.facilidade));
  const Yz = zScore(notasHumanas);

  let [wU, wI, wF] = olsSem3(Us, Is, Fs, Yz);

  // Clamp para que cada peso seja positivo (mínimo 0.1)
  wU = Math.max(0.1, wU);
  wI = Math.max(0.1, wI);
  wF = Math.max(0.1, wF);

  // Normalizar para soma = 1
  const soma = wU + wI + wF;
  wU = wU / soma;
  wI = wI / soma;
  wF = wF / soma;

  // Clamp máximo 0.8 (redistribui excesso proporcionalmente)
  const MAX = 0.8;
  const MIN = 0.1;
  const clampMax = (a: number, b: number, c: number): [number, number, number] => {
    let [x, y, z] = [a, b, c];
    for (let _iter = 0; _iter < 10; _iter++) {
      let excess = 0;
      let freeSum = 0;
      if (x > MAX) { excess += x - MAX; x = MAX; } else freeSum += x;
      if (y > MAX) { excess += y - MAX; y = MAX; } else freeSum += y;
      if (z > MAX) { excess += z - MAX; z = MAX; } else freeSum += z;
      if (excess < 1e-9) break;
      if (freeSum > 1e-9) {
        if (x < MAX) x += (x / freeSum) * excess;
        if (y < MAX) y += (y / freeSum) * excess;
        if (z < MAX) z += (z / freeSum) * excess;
      }
      // enforce min
      x = Math.max(MIN, x); y = Math.max(MIN, y); z = Math.max(MIN, z);
      const s2 = x + y + z; x /= s2; y /= s2; z /= s2;
    }
    return [x, y, z];
  };
  [wU, wI, wF] = clampMax(wU, wI, wF);

  // Correlação depois: pearson(notaRecalculada, notaHumana)
  const notasRecalculadas = amostras.map((a) =>
    Math.round(
      Math.max(0, Math.min(100, wU * a.urgencia + wI * a.importancia + wF * a.facilidade)),
    ),
  );
  const correlacaoDepois = pearson(notasRecalculadas, notasHumanas);

  return {
    pesosNovos: {
      urgencia: Math.round(wU * 1000) / 1000,
      importancia: Math.round(wI * 1000) / 1000,
      facilidade: Math.round(wF * 1000) / 1000,
    },
    correlacaoAntes,
    correlacaoDepois,
    amostras: n,
  };
}

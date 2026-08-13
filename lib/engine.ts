/* ============================================================
   NEXUS · Win Go forecast core (framework-agnostic engine)
   ============================================================ */

export type Size = "BIG" | "SMALL";
export type Color = "RED" | "GREEN";
export type Mode = "SIZE" | "COLOR" | "SKIP";
export type Status = "WIN" | "LOSS" | "SKIP" | "JACKPOT";

export function sizeOf(d: number): Size {
  return d >= 5 ? "BIG" : "SMALL";
}
export function colorOf(d: number): Color {
  if (d === 0) return "RED";
  if (d === 5) return "GREEN";
  return d % 2 === 1 ? "GREEN" : "RED";
}
export function isViolet(d: number): boolean {
  return d === 0 || d === 5;
}

export const ROUND_SECONDS = 30;
export const HISTORY_MAX = 60;
export const DEPTH_MAX = 1000;
export const PAYOUT = 2;
export const PLAN = [1, 3, 8];

export interface EngineResult {
  pick: Size | Color | null;
  conf: number;
}
export interface Engines {
  dragon: EngineResult;
  zigzag: EngineResult;
  mirror: EngineResult;
  markov: EngineResult;
}
export interface Jackpot {
  digit: number;
  prob: number;
}
export interface Prediction {
  mode: Mode;
  pick: Size | Color | "SKIP";
  conf: number;
  engine: string;
  engines: Engines;
  jackpot: Jackpot;
  level: number;
  stake: number;
  period: string;
}

/* ---------- analysis engines ---------- */
function sizeSeq(results: number[], n: number): Size[] {
  return results.slice(-n).map(sizeOf);
}
function colorSeq(results: number[], n: number): Color[] {
  return results.slice(-n).map(colorOf);
}

export function engineDragon(results: number[]): EngineResult {
  const s = sizeSeq(results, 30);
  if (s.length < 4) return { pick: null, conf: 0 };
  const last = s[s.length - 1];
  let run = 1;
  for (let i = s.length - 2; i >= 0; i--) {
    if (s[i] === last) run++;
    else break;
  }
  if (run < 3) return { pick: null, conf: 0.2 };
  if (run <= 5) {
    const conf = Math.min(0.55 + run * 0.06, 0.9);
    return { pick: last, conf };
  }
  const conf = Math.min(0.55 + (run - 5) * 0.08, 0.92);
  return { pick: last === "BIG" ? "SMALL" : "BIG", conf };
}

export function engineZigZag(results: number[]): EngineResult {
  const s = sizeSeq(results, 12);
  if (s.length < 5) return { pick: null, conf: 0 };
  let alt = 0;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) alt++;
  const ratio = alt / (s.length - 1);
  if (ratio < 0.7) return { pick: null, conf: 0.2 };
  const last = s[s.length - 1];
  const conf = Math.min(0.5 + (ratio - 0.7) * 1.4, 0.9);
  return { pick: last === "BIG" ? "SMALL" : "BIG", conf };
}

export function engineMirror(results: number[]): EngineResult {
  const s = sizeSeq(results, 6);
  if (s.length < 4) return { pick: null, conf: 0 };
  const a = s.slice(-4);
  if (a[0] === a[1] && a[2] === a[3] && a[0] !== a[2]) return { pick: a[0], conf: 0.7 };
  if (a[1] === a[2] && a[0] !== a[1]) return { pick: a[0], conf: 0.66 };
  if (a[0] === a[2] && a[1] === a[3] && a[0] !== a[1])
    return { pick: a[1] === "BIG" ? "SMALL" : "BIG", conf: 0.58 };
  return { pick: null, conf: 0.15 };
}

export function engineMarkov(results: number[]): EngineResult {
  const s = results.map(sizeOf);
  if (s.length < 12) return { pick: null, conf: 0 };
  const trans: Record<Size, Record<Size, number>> = {
    BIG: { BIG: 1, SMALL: 1 },
    SMALL: { BIG: 1, SMALL: 1 },
  };
  for (let i = 1; i < s.length; i++) trans[s[i - 1]][s[i]]++;
  const last = s[s.length - 1];
  const row = trans[last];
  const total = row.BIG + row.SMALL;
  const pBig = row.BIG / total;
  const pick: Size = pBig >= 0.5 ? "BIG" : "SMALL";
  const conf = Math.abs(pBig - 0.5) * 2;
  return { pick, conf: Math.min(0.5 + conf * 0.5, 0.95) };
}

export function engineColor(results: number[]): EngineResult {
  const c = colorSeq(results, 20);
  if (c.length < 6) return { pick: null, conf: 0 };
  let g = 0,
    r = 0;
  c.forEach((x) => (x === "GREEN" ? g++ : r++));
  const last = c[c.length - 1];
  let run = 1;
  for (let i = c.length - 2; i >= 0; i--) {
    if (c[i] === last) run++;
    else break;
  }
  const bias = Math.abs(g - r) / c.length;
  let pick: Color, conf: number;
  if (run >= 4) {
    pick = last === "GREEN" ? "RED" : "GREEN";
    conf = Math.min(0.55 + run * 0.05, 0.85);
  } else {
    pick = g >= r ? "GREEN" : "RED";
    conf = Math.min(0.5 + bias, 0.8);
  }
  return { pick, conf };
}

export function computeVolatility(results: number[]): number {
  const s = sizeSeq(results, 20);
  if (s.length < 6) return 0.3;
  let flips = 0;
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) flips++;
  return flips / (s.length - 1);
}

export function predictJackpot(period: string, results: number[]): Jackpot {
  let seed = 0;
  for (let i = 0; i < period.length; i++) seed = (seed * 31 + period.charCodeAt(i)) >>> 0;
  const recent = results.slice(-15);
  const recentSum = recent.reduce((a, b) => a + b, 0);
  const seedDigit = (seed + recentSum * 7) % 10;

  const freq = new Array(10).fill(0);
  results.slice(-200).forEach((d) => freq[d]++);
  const totalF = freq.reduce((a, b) => a + b, 0) || 1;
  let best = 0,
    bestScore = -Infinity;
  const probs = new Array(10).fill(0);
  for (let d = 0; d < 10; d++) {
    const dist = Math.min(Math.abs(d - seedDigit), 10 - Math.abs(d - seedDigit));
    const proximity = 1 - dist / 5;
    const rarity = 1 - freq[d] / (totalF / 10 + 1);
    const score = proximity * 1.4 + rarity * 0.8;
    probs[d] = score;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  const exps = probs.map((x) => Math.exp(x));
  const sum = exps.reduce((a, b) => a + b, 0);
  const prob = exps[best] / sum;
  return { digit: best, prob };
}

export function buildPrediction(
  results: number[],
  level: number,
  period: string,
): { prediction: Prediction; volatility: number } {
  const engines: Engines = {
    dragon: engineDragon(results),
    zigzag: engineZigZag(results),
    mirror: engineMirror(results),
    markov: engineMarkov(results),
  };
  const weights: Record<keyof Engines, number> = {
    dragon: 1.0,
    zigzag: 0.9,
    mirror: 0.85,
    markov: 1.15,
  };
  let big = 0,
    small = 0,
    totalW = 0,
    contributor = "MARKOV",
    topConf = 0;
  (Object.keys(engines) as (keyof Engines)[]).forEach((k) => {
    const e = engines[k];
    if (!e.pick) return;
    const w = weights[k] * e.conf;
    if (e.pick === "BIG") big += w;
    else if (e.pick === "SMALL") small += w;
    totalW += weights[k] * e.conf;
    if (e.conf > topConf) {
      topConf = e.conf;
      contributor = k.toUpperCase();
    }
  });

  const vol = computeVolatility(results);

  let sizePick: Size | null = null;
  let sizeConf = 0;
  if (totalW > 0) {
    sizePick = big >= small ? "BIG" : "SMALL";
    const dominance = Math.abs(big - small) / (big + small || 1);
    sizeConf = Math.min(0.45 + dominance * 0.5 + topConf * 0.15, 0.97);
  }

  const choppy = vol > 0.62 && vol < 0.9;
  if (choppy) sizeConf *= 0.7;

  const jackpot = predictJackpot(period, results);

  const SIZE_THRESHOLD = 0.6;
  const COLOR_THRESHOLD = 0.62;

  let mode: Mode = "SIZE";
  let pick: Size | Color | "SKIP" = sizePick ?? "SKIP";
  let conf = sizeConf;
  let engine = contributor;

  if (!sizePick || sizeConf < SIZE_THRESHOLD) {
    const col = engineColor(results);
    if (col.pick && col.conf >= COLOR_THRESHOLD && !choppy) {
      mode = "COLOR";
      pick = col.pick;
      conf = col.conf;
      engine = "COLOR-TREND";
    } else {
      mode = "SKIP";
      pick = "SKIP";
      conf = Math.max(sizeConf, col.conf || 0);
    }
  }

  if (results.length < 8) {
    mode = "SKIP";
    pick = "SKIP";
    conf = 0.2;
  }
  if (vol >= 0.9) {
    mode = "SKIP";
    pick = "SKIP";
  }

  const prediction: Prediction = {
    mode,
    pick,
    conf,
    engine,
    engines,
    jackpot,
    level,
    stake: PLAN[level],
    period,
  };
  return { prediction, volatility: vol };
}

export function drawResult(results: number[]): number {
  const r = Math.random();
  const last = results[results.length - 1];
  if (last != null && r < 0.34) {
    const band = sizeOf(last) === "BIG" ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
    return band[Math.floor(Math.random() * band.length)];
  }
  return Math.floor(Math.random() * 10);
}

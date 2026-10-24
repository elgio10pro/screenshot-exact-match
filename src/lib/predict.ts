// Pure prediction logic: team stats + smoothed Poisson model.

export type MatchRow = {
  fecha_nro: number;
  categoria: number;
  local_key: string;
  visitante_key: string;
  goles_local: number | null;
  goles_visitante: number | null;
};

export type Result = "V" | "E" | "D";

export type TeamStats = {
  key: string;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  promGF: number;
  promGC: number;
  forma: Result[]; // most recent first, max 5
};

/** Matches with real scores, from the point of view of `key`. */
function teamGames(rows: MatchRow[], key: string) {
  return rows
    .filter((r) => r.goles_local !== null && r.goles_visitante !== null)
    .filter((r) => r.local_key === key || r.visitante_key === key)
    .map((r) => {
      const home = r.local_key === key;
      const gf = (home ? r.goles_local : r.goles_visitante) as number;
      const gc = (home ? r.goles_visitante : r.goles_local) as number;
      return { fecha: r.fecha_nro, rival: home ? r.visitante_key : r.local_key, gf, gc };
    })
    .sort((a, b) => b.fecha - a.fecha);
}

const res = (gf: number, gc: number): Result => (gf > gc ? "V" : gf === gc ? "E" : "D");

export function teamStats(rows: MatchRow[], key: string): TeamStats {
  const g = teamGames(rows, key);
  const s: TeamStats = { key, pj: g.length, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, promGF: 0, promGC: 0, forma: [] };
  for (const x of g) {
    s.gf += x.gf;
    s.gc += x.gc;
    const r = res(x.gf, x.gc);
    if (r === "V") s.pg++;
    else if (r === "E") s.pe++;
    else s.pp++;
  }
  s.promGF = s.pj ? s.gf / s.pj : 0;
  s.promGC = s.pj ? s.gc / s.pj : 0;
  s.forma = g.slice(0, 5).map((x) => res(x.gf, x.gc));
  return s;
}

export function headToHead(rows: MatchRow[], a: string, b: string) {
  const g = teamGames(rows, a).filter((x) => x.rival === b);
  return {
    partidos: g.length,
    ganaA: g.filter((x) => x.gf > x.gc).length,
    empates: g.filter((x) => x.gf === x.gc).length,
    ganaB: g.filter((x) => x.gf < x.gc).length,
    resultados: g.map((x) => `${x.gf}-${x.gc} (fecha ${x.fecha})`),
  };
}

export function commonOpponents(rows: MatchRow[], a: string, b: string) {
  const ga = teamGames(rows, a);
  const gb = teamGames(rows, b);
  const rivals = new Set(ga.map((x) => x.rival).filter((r) => r !== b && gb.some((y) => y.rival === r)));
  return [...rivals].map((r) => ({
    rival: r,
    a: ga.filter((x) => x.rival === r).map((x) => `${x.gf}-${x.gc}`),
    b: gb.filter((x) => x.rival === r).map((x) => `${x.gf}-${x.gc}`),
  }));
}

export function categoryAvgGoals(rows: MatchRow[]): number {
  const played = rows.filter((r) => r.goles_local !== null && r.goles_visitante !== null);
  if (!played.length) return 1.5;
  const total = played.reduce((s, r) => s + (r.goles_local as number) + (r.goles_visitante as number), 0);
  return total / (played.length * 2); // goals per team per match
}

export const SMOOTH_K = 3;

/** Shrink a team's per-match rate toward the category mean. */
export function smoothRate(total: number, n: number, mean: number, k = SMOOTH_K) {
  return (total + k * mean) / (n + k);
}

export function poissonPmf(lambda: number, k: number) {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / f;
}

export function poissonOutcome(lambdaA: number, lambdaB: number, max = 15) {
  let win = 0, draw = 0, loss = 0, best = { a: 0, b: 0, p: -1 };
  for (let i = 0; i <= max; i++) {
    const pi = poissonPmf(lambdaA, i);
    for (let j = 0; j <= max; j++) {
      const p = pi * poissonPmf(lambdaB, j);
      if (i > j) win += p;
      else if (i === j) draw += p;
      else loss += p;
      if (p > best.p) best = { a: i, b: j, p };
    }
  }
  const tot = win + draw + loss;
  return { win: win / tot, draw: draw / tot, loss: loss / tot, score: best };
}

export function predict(rows: MatchRow[], a: string, b: string) {
  const mean = categoryAvgGoals(rows);
  const sa = teamStats(rows, a);
  const sb = teamStats(rows, b);
  const attA = smoothRate(sa.gf, sa.pj, mean);
  const defA = smoothRate(sa.gc, sa.pj, mean);
  const attB = smoothRate(sb.gf, sb.pj, mean);
  const defB = smoothRate(sb.gc, sb.pj, mean);
  const lambdaA = (attA * defB) / mean;
  const lambdaB = (attB * defA) / mean;
  const out = poissonOutcome(lambdaA, lambdaB);
  return {
    promedioCategoria: mean,
    statsA: sa,
    statsB: sb,
    golesEsperadosA: lambdaA,
    golesEsperadosB: lambdaB,
    probGana: out.win,
    probEmpata: out.draw,
    probPierde: out.loss,
    marcador: { a: out.score.a, b: out.score.b, prob: out.score.p },
    h2h: headToHead(rows, a, b),
    comunes: commonOpponents(rows, a, b),
    pocosDatos: sa.pj < 3 || sb.pj < 3,
  };
}

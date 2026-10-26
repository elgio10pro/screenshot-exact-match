import { predict, teamStats, type MatchRow } from "./predict";

export const ZONA_NIVEL = [..."ABCDEFGHIJKL", "Blanca", "Bordo", "Celeste", "Oro", "Verde", "Violeta"].map((zona, i) => ({ zona, nivel: i + 1 }));
export type CompactMatch = { t: string; f: number; c: string; lk: string; vk: string; gl: number | null; gv: number | null; z?: string };
export type Dataset = { updatedAt: string; names: Record<string, string>; matches: CompactMatch[] };
export type Team = { key: string; nombre: string; cat: string; zona: string; nivel: number; pj: number };
export const annualMatches = (data: Dataset) => data.matches.filter(m => (m.t === "Anual Apertura" || m.t === "Anual Clausura") && ZONA_NIVEL.some(z => z.zona === m.z));
export const categories = (data: Dataset) => [...new Set(annualMatches(data).map(m => m.c))].sort((a,b) => a.localeCompare(b, "es", { numeric: true }));
export function categoryRows(data: Dataset, cat: string): MatchRow[] {
  return annualMatches(data).filter(m => m.c === cat).map(m => ({ fecha_nro: m.f, categoria: Number(cat), torneo: m.t, zona: m.z ?? "", local_key: m.lk, visitante_key: m.vk, goles_local: m.gl, goles_visitante: m.gv }));
}
// Local equivalent of equipos_actuales: latest appearance assigns the zone,
// but played games count both tournaments and all historical zones.
export function currentTeams(data: Dataset, cat: string): Team[] {
  const rows = categoryRows(data, cat);
  const latest = [...rows].sort((a,b) => Number(b.torneo === "Anual Clausura") - Number(a.torneo === "Anual Clausura") || b.fecha_nro - a.fecha_nro);
  const teams = new Map<string, Team>();
  for (const r of latest) for (const key of [r.local_key, r.visitante_key]) {
    if (teams.has(key)) continue;
    const zone = ZONA_NIVEL.find(z => z.zona === r.zona);
    if (!zone) continue;
    teams.set(key, { key, nombre: data.names[key] ?? key, cat, ...zone, pj: teamStats(rows, key).pj });
  }
  return [...teams.values()].sort((a,b) => a.nombre.localeCompare(b.nombre, "es"));
}
export function predictMatch(data: Dataset, cat: string, a: Team, b: Team) {
  if (a.key === b.key || a.cat !== cat || b.cat !== cat || !a.pj || !b.pj) throw new Error("Elegí dos equipos distintos con partidos jugados");
  return { ...predict(categoryRows(data, cat), a.key, b.key, a, b), nombreA: a.nombre, nombreB: b.nombre };
}
export async function loadDataset(): Promise<Dataset> {
  const res = await fetch("/data/matches.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("No pudimos cargar los equipos.");
  return res.json();
}
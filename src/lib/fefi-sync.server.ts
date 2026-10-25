import { ANUAL_ZONAS, normalizeTeam, parseAnualHtml } from "./fefi-parse";

const ANUAL_API = "https://fefi.com.ar/wp-json/fefit/v1/vista";
const VISTAS = [
  { vista: "fechas-apertura", torneo: "Anual Apertura" },
  { vista: "fechas-clausura", torneo: "Anual Clausura" },
];

/** 18 zonas × (Apertura, Clausura). La Copa de Campeones ya no se sincroniza. */
export const SYNC_UNITS = ANUAL_ZONAS.length * VISTAS.length;

/** Unidades que procesa cada llamada del cron (con cron horario: 72 unidades/día > 36). */
export const UNITS_PER_RUN = 3;

export function describeUnit(unit: number) {
  const z = ANUAL_ZONAS[Math.floor(unit / VISTAS.length)]!;
  const v = VISTAS[unit % VISTAS.length]!;
  return `Zona ${z.nombre} · ${v.torneo.replace("Anual ", "")}`;
}

const UA = { "User-Agent": "Mozilla/5.0 (predictor-fefi)" };

async function fetchUnit(unit: number) {
  const z = ANUAL_ZONAS[Math.floor(unit / VISTAS.length)]!;
  const v = VISTAS[unit % VISTAS.length]!;
  const res = await fetch(`${ANUAL_API}?torneo=1&zona=${z.id}&vista=${v.vista}`, { headers: UA });
  if (!res.ok) throw new Error(`No se pudo leer FEFI (${res.status})`);
  const json = (await res.json()) as { html?: string };
  return parseAnualHtml(json.html ?? "", v.torneo, z.nombre);
}

export async function runSyncUnit(unit: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const parsed = await fetchUnit(unit);

  const { data: aliases } = await supabaseAdmin.from("team_aliases").select("alias_key, canonical_key");
  const map = new Map((aliases ?? []).map((a) => [a.alias_key, a.canonical_key]));
  const canon = (n: string) => map.get(normalizeTeam(n)) ?? normalizeTeam(n);

  const seen = new Map<string, Record<string, unknown>>();
  const names = new Map<string, string>();
  const now = new Date().toISOString();
  for (const p of parsed) {
    const local_key = canon(p.equipo_local);
    const visitante_key = canon(p.equipo_visitante);
    for (const n of [p.equipo_local, p.equipo_visitante]) if (!names.has(normalizeTeam(n))) names.set(normalizeTeam(n), n);
    const id = [p.torneo, p.anio, p.zona, p.fecha_nro, p.sede, p.hora, p.cat, local_key, visitante_key].join("|");
    seen.set(id, { ...p, local_key, visitante_key, updated_at: now });
  }
  const rows = [...seen.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from("matches").upsert(rows.slice(i, i + 500) as never, {
      onConflict: "torneo,anio,zona,fecha_nro,sede,hora,cat,local_key,visitante_key",
    });
    if (error) throw new Error(error.message);
  }
  const aliasRows = [...names.entries()]
    .filter(([k]) => !map.has(k))
    .map(([k, display]) => ({ alias_key: k, canonical_key: k, display_name: display }));
  if (aliasRows.length) {
    await supabaseAdmin.from("team_aliases").upsert(aliasRows, { onConflict: "alias_key", ignoreDuplicates: true });
  }
  return { unidad: describeUnit(unit), partidos: rows.length, jugados: rows.filter((r) => r["goles_local"] !== null).length };
}

/** Cron step: sync the next UNITS_PER_RUN units in rotation; a failing unit doesn't stop the rest. */
export async function runNextSyncUnit() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("sync_state").select("next_unit").eq("id", 1).maybeSingle();
  let unit = (data?.next_unit ?? 0) % SYNC_UNITS;
  const resultados: { unidad: string; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < UNITS_PER_RUN; i++) {
    try {
      await runSyncUnit(unit);
      resultados.push({ unidad: describeUnit(unit), ok: true });
    } catch (e) {
      resultados.push({ unidad: describeUnit(unit), ok: false, error: (e as Error).message });
    }
    unit = (unit + 1) % SYNC_UNITS;
  }
  await supabaseAdmin.from("sync_state").upsert({ id: 1, next_unit: unit, updated_at: new Date().toISOString() });
  return { resultados, proxima_unidad: unit };
}

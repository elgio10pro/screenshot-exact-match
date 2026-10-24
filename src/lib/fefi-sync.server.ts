import { normalizeTeam, parseFefiHtml } from "./fefi-parse";

export const FEFI_URL = "https://fefi.com.ar/2026-copa-de-campeones/";

export async function runFefiSync() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const res = await fetch(FEFI_URL, { headers: { "User-Agent": "Mozilla/5.0 (predictor-fefi)" } });
  if (!res.ok) throw new Error(`No se pudo leer FEFI (${res.status})`);
  const html = await res.text();
  const parsed = parseFefiHtml(html);
  if (!parsed.length) throw new Error("No se encontraron partidos en la página");

  const { data: aliases } = await supabaseAdmin.from("team_aliases").select("alias_key, canonical_key");
  const map = new Map((aliases ?? []).map((a) => [a.alias_key, a.canonical_key]));
  const canon = (n: string) => {
    const k = normalizeTeam(n);
    return map.get(k) ?? k;
  };

  const seen = new Map<string, Record<string, unknown>>();
  const names = new Map<string, string>();
  for (const p of parsed) {
    const local_key = canon(p.equipo_local);
    const visitante_key = canon(p.equipo_visitante);
    if (!names.has(normalizeTeam(p.equipo_local))) names.set(normalizeTeam(p.equipo_local), p.equipo_local);
    if (!names.has(normalizeTeam(p.equipo_visitante))) names.set(normalizeTeam(p.equipo_visitante), p.equipo_visitante);
    const id = [p.torneo, p.anio, p.fecha_nro, p.sede, p.hora, p.categoria, local_key, visitante_key].join("|");
    seen.set(id, { ...p, local_key, visitante_key, updated_at: new Date().toISOString() });
  }
  const rows = [...seen.values()];
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabaseAdmin.from("matches").upsert(rows.slice(i, i + 500) as never, {
      onConflict: "torneo,anio,fecha_nro,sede,hora,categoria,local_key,visitante_key",
    });
    if (error) throw new Error(error.message);
  }
  // Register every seen spelling (keeps manual overrides intact).
  const aliasRows = [...names.entries()]
    .filter(([k]) => !map.has(k))
    .map(([k, display]) => ({ alias_key: k, canonical_key: k, display_name: display }));
  if (aliasRows.length) {
    await supabaseAdmin.from("team_aliases").upsert(aliasRows, { onConflict: "alias_key", ignoreDuplicates: true });
  }
  return {
    partidos: rows.length,
    jugados: rows.filter((r) => r['goles_local'] !== null).length,
  };
}

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { predict, type MatchRow } from "./predict";

function publicClient() {
  return createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Scope = { torneo: "anual" | "copa"; zona?: string | undefined };

export const syncUnit = createServerFn({ method: "POST" })
  .inputValidator((d: { unit: number }) => ({ unit: Math.max(0, Math.floor(Number(d.unit))) }))
  .handler(async ({ data }) => {
    const { runSyncUnit, SYNC_UNITS } = await import("./fefi-sync.server");
    if (data.unit >= SYNC_UNITS) return { ok: false as const, error: "Unidad inválida" };
    try {
      return { ok: true as const, ...(await runSyncUnit(data.unit)) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

export type Team = { key: string; nombre: string; pj: number };

const validScope = (d: Scope): Scope => ({
  torneo: d.torneo === "copa" ? "copa" : "anual",
  zona: d.zona ? String(d.zona).slice(0, 20) : undefined,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped<T>(q: T, s: Scope): T {
  const b = q as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (s.torneo === "copa") return b.eq("torneo", "Copa de Campeones");
  return b.in("torneo", ["Anual Apertura", "Anual Clausura"]).eq("zona", s.zona ?? "");
}

async function loadCategory(s: Scope, cat: string) {
  const sb = publicClient();
  const q = sb
    .from("matches")
    .select("torneo, fecha_nro, cat, local_key, visitante_key, equipo_local, equipo_visitante, goles_local, goles_visitante")
    .eq("cat", cat)
    .limit(5000);
  const { data, error } = await scoped(q, s);
  if (error) throw new Error(error.message);
  // Clausura comes after Apertura in time: shift its fecha so "recent form" is ordered right.
  return (data ?? []).map((r) => ({ ...r, categoria: 0, fecha_nro: r.torneo === "Anual Clausura" ? r.fecha_nro + 100 : r.fecha_nro }));
}

export const getCategories = createServerFn({ method: "GET" })
  .inputValidator(validScope)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const q = sb.from("matches").select("cat").not("goles_local", "is", null).limit(10000);
    const { data: rows, error } = await scoped(q, data);
    if (error) throw new Error(error.message);
    return [...new Set((rows ?? []).map((r) => r.cat))].sort();
  });

export const searchTeams = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").trim().slice(0, 40) }))
  .handler(async ({ data }) => {
    if (data.q.length < 2) return [];
    const sb = publicClient();
    const like = `%${data.q.replace(/[%_,()]/g, "")}%`;
    const { data: rows, error } = await sb
      .from("matches")
      .select("zona, local_key, equipo_local, visitante_key, equipo_visitante")
      .in("torneo", ["Anual Apertura", "Anual Clausura"])
      .or(`equipo_local.ilike.${like},equipo_visitante.ilike.${like}`)
      .limit(1000);
    if (error) throw new Error(error.message);
    const needle = data.q.toLowerCase();
    const out = new Map<string, { key: string; nombre: string; zona: string }>();
    for (const r of rows ?? []) {
      for (const [k, n] of [[r.local_key, r.equipo_local], [r.visitante_key, r.equipo_visitante]] as const) {
        if (n.toLowerCase().includes(needle)) out.set(`${r.zona}|${k}`, { key: k, nombre: n, zona: r.zona });
      }
    }
    return [...out.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).slice(0, 30);
  });

export const getTeams = createServerFn({ method: "GET" })
  .inputValidator((d: Scope & { cat: string }) => ({ ...validScope(d), cat: String(d.cat) }))
  .handler(async ({ data }) => {
    const rows = await loadCategory(data, data.cat);
    const teams = new Map<string, Team>();
    for (const r of rows) {
      for (const [k, n] of [[r.local_key, r.equipo_local], [r.visitante_key, r.equipo_visitante]] as const) {
        const t = teams.get(k) ?? { key: k, nombre: n, pj: 0 };
        if (r.goles_local !== null && r.goles_visitante !== null) t.pj++;
        teams.set(k, t);
      }
    }
    return [...teams.values()].filter((t) => t.pj > 0).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  });

async function writeExplanation(payload: unknown): Promise<string | null> {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return null;
  const { createOpenAI } = await import("@ai-sdk/openai");
  const { streamText } = await import("ai");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    // cast: nested @ai-sdk/provider versions differ only in types
    model: provider.responses("openai/gpt-6-astra") as unknown as Parameters<typeof streamText>[0]["model"],
    system:
      "Sos un comentarista de fútbol infantil argentino. Escribí 3 o 4 oraciones en español rioplatense (voseo), tono cálido y divertido, explicando el pronóstico. Usá SOLO los datos del JSON recibido: no inventes jugadores, lesiones, historia ni cifras que no estén. Redondeá porcentajes. Recordá que es un juego y lo importante es divertirse. Sin títulos ni listas.",
    messages: [{ role: "user", content: JSON.stringify(payload) }],
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    const text = (await result.text).trim();
    return text || null;
  } catch (e) {
    console.error("AI error", e);
    return null;
  }
}

export const predictMatch = createServerFn({ method: "POST" })
  .inputValidator((d: Scope & { cat: string; a: string; b: string }) => {
    if (!d.a || !d.b || d.a === d.b) throw new Error("Elegí dos clubes distintos");
    return { ...validScope(d), cat: String(d.cat), a: String(d.a), b: String(d.b) };
  })
  .handler(async ({ data }) => {
    const rows = await loadCategory(data, data.cat);
    const nameOf = (k: string) =>
      rows.find((r) => r.local_key === k)?.equipo_local ?? rows.find((r) => r.visitante_key === k)?.equipo_visitante ?? k;
    const p = predict(rows as MatchRow[], data.a, data.b);
    const nombreA = nameOf(data.a);
    const nombreB = nameOf(data.b);
    const nm = (k: string) => nameOf(k);
    const payload = {
      torneo: data.torneo === "copa" ? "Copa de Campeones" : `Torneo Anual (Apertura + Clausura), Zona ${data.zona}`,
      categoria: data.cat,
      miClub: nombreA,
      rival: nombreB,
      marcadorMasProbable: `${nombreA} ${p.marcador.a} - ${p.marcador.b} ${nombreB}`,
      probabilidades: {
        ganaMiClub: Math.round(p.probGana * 100),
        empate: Math.round(p.probEmpata * 100),
        ganaRival: Math.round(p.probPierde * 100),
      },
      miClubStats: { ...p.statsA, key: undefined, forma: undefined, ultimos5_delMasRecienteAlMasViejo: p.statsA.forma.join(" ") },
      rivalStats: { ...p.statsB, key: undefined, forma: undefined, ultimos5_delMasRecienteAlMasViejo: p.statsB.forma.join(" ") },
      enfrentamientosDirectos: p.h2h,
      rivalesEnComun: p.comunes.map((c) => ({ ...c, rival: nm(c.rival) })),
      promedioGolesCategoria: Number(p.promedioCategoria.toFixed(2)),
      pocosDatos: p.pocosDatos,
    };
    const texto = await writeExplanation(payload);
    return {
      ...p,
      nombreA,
      nombreB,
      comunes: p.comunes.map((c) => ({ ...c, rival: nm(c.rival) })),
      texto,
    };
  });

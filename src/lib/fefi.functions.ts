import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { predict, type MatchRow } from "./predict";

function publicClient() {
  return createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const syncFefi = createServerFn({ method: "POST" }).handler(async () => {
  const { runFefiSync } = await import("./fefi-sync.server");
  try {
    return { ok: true as const, ...(await runFefiSync()) };
  } catch (e) {
    return { ok: false as const, error: (e as Error).message };
  }
});

export type Team = { key: string; nombre: string; pj: number };

async function loadCategory(categoria: number) {
  const sb = publicClient();
  const { data, error } = await sb
    .from("matches")
    .select("fecha_nro, categoria, local_key, visitante_key, equipo_local, equipo_visitante, goles_local, goles_visitante")
    .eq("categoria", categoria)
    .limit(5000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const getTeams = createServerFn({ method: "GET" })
  .inputValidator((d: { categoria: number }) => ({ categoria: Number(d.categoria) }))
  .handler(async ({ data }) => {
    const rows = await loadCategory(data.categoria);
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
  .inputValidator((d: { categoria: number; a: string; b: string }) => {
    if (!d.a || !d.b || d.a === d.b) throw new Error("Elegí dos clubes distintos");
    return { categoria: Number(d.categoria), a: String(d.a), b: String(d.b) };
  })
  .handler(async ({ data }) => {
    const rows = await loadCategory(data.categoria);
    const nameOf = (k: string) =>
      rows.find((r) => r.local_key === k)?.equipo_local ?? rows.find((r) => r.visitante_key === k)?.equipo_visitante ?? k;
    const p = predict(rows as MatchRow[], data.a, data.b);
    const nombreA = nameOf(data.a);
    const nombreB = nameOf(data.b);
    const nm = (k: string) => nameOf(k);
    const payload = {
      categoria: data.categoria,
      miClub: nombreA,
      rival: nombreB,
      marcadorMasProbable: `${nombreA} ${p.marcador.a} - ${p.marcador.b} ${nombreB}`,
      probabilidades: {
        ganaMiClub: Math.round(p.probGana * 100),
        empate: Math.round(p.probEmpata * 100),
        ganaRival: Math.round(p.probPierde * 100),
      },
      miClubStats: { ...p.statsA, key: undefined },
      rivalStats: { ...p.statsB, key: undefined },
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

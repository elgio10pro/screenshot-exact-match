import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getTeams, predictMatch, syncUnit, type Team } from "@/lib/fefi.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Predictor de Partidos – Fútbol Infantil" },
      { name: "description", content: "Pronóstico no oficial de partidos de la liga FEFI por categoría, con resultados reales de la Copa de Campeones." },
      { property: "og:title", content: "Predictor de Partidos – Fútbol Infantil" },
      { property: "og:description", content: "¿Cómo sale el partido? Probabilidades y marcador estimado para clubes FEFI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CATS = [12, 13, 14, 15, 16, 17, 18];
type Prediction = Awaited<ReturnType<typeof predictMatch>>;

function Shield({ tone }: { tone: "a" | "b" }) {
  return (
    <svg viewBox="0 0 64 76" className="h-16 w-14 drop-shadow" aria-hidden>
      <path
        d="M32 2 L60 12 V36 C60 56 46 68 32 74 C18 68 4 56 4 36 V12 Z"
        className={tone === "a" ? "fill-primary stroke-secondary" : "fill-accent stroke-secondary"}
        strokeWidth="4"
      />
      <path d="M32 12 V66" className="stroke-card" strokeWidth="6" opacity=".7" />
      <circle cx="32" cy="36" r="9" className="fill-card stroke-secondary" strokeWidth="3" />
    </svg>
  );
}

function Forma({ f }: { f: ("V" | "E" | "D")[] }) {
  if (!f.length) return <span className="text-sm text-muted-foreground">sin partidos</span>;
  const cls = { V: "bg-win", E: "bg-draw", D: "bg-loss" };
  return (
    <div className="flex gap-1" title="Del más viejo al más reciente">
      {[...f].reverse().map((r, i) => (
        <span key={i} className={`grid h-7 w-7 place-items-center rounded-full font-display text-sm text-accent-foreground ${cls[r]}`}>
          {r}
        </span>
      ))}
    </div>
  );
}

function Bar({ label, p, cls }: { label: string; p: number; cls: string }) {
  const pct = Math.round(p * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm font-bold">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${cls} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const selectCls =
  "w-full appearance-none rounded-2xl border-4 border-secondary bg-card px-4 py-4 text-lg font-bold text-card-foreground outline-none focus:ring-4 focus:ring-ring disabled:opacity-60";

function Index() {
  const fetchTeams = useServerFn(getTeams);
  const doPredict = useServerFn(predictMatch);
  const doSync = useServerFn(syncUnit);

  const [cat, setCat] = useState<number | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pred, setPred] = useState<Prediction | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (cat === null) return;
    setLoadingTeams(true);
    setA(""); setB(""); setPred(null);
    fetchTeams({ data: { torneo: "copa", cat: String(cat) } })
      .then(setTeams)
      .catch(() => setMsg("No pudimos cargar los equipos."))
      .finally(() => setLoadingTeams(false));
  }, [cat, reload, fetchTeams]);

  async function onSync() {
    setSyncing(true); setMsg(null);
    const r = await doSync({ data: { unit: 0 } }).catch((e: Error) => ({ ok: false as const, error: e.message }));
    setSyncing(false);
    setMsg(r.ok ? `¡Listo! ${r.partidos} partidos (${r.jugados} con resultado).` : `Error al actualizar: ${r.error}`);
    if (r.ok) setReload((x) => x + 1);
  }

  async function onPredict() {
    if (!cat || !a || !b) return;
    setLoading(true); setPred(null); setMsg(null);
    try {
      setPred(await doPredict({ data: { torneo: "copa", cat: String(cat), a, b } }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <header className="mb-6 text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="font-display text-4xl leading-tight text-chalk drop-shadow">Predictor de Partidos</h1>
        <p className="font-display text-xl text-primary">Fútbol Infantil · FEFI</p>
        <p className="mt-1 text-xs opacity-80">App no oficial · datos de la Copa de Campeones 2026</p>
      </header>

      <section className="space-y-5 rounded-3xl bg-card p-5 text-card-foreground shadow-card">
        <div>
          <p className="mb-2 font-display text-xl">1. Categoría</p>
          <div className="grid grid-cols-4 gap-2">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-2xl border-4 py-3 font-display text-2xl transition active:translate-y-1 ${
                  cat === c ? "border-secondary bg-primary text-primary-foreground shadow-pop" : "border-border bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 font-display text-xl">2. Mi club</p>
          <select className={selectCls} value={a} onChange={(e) => setA(e.target.value)} disabled={!cat || loadingTeams}>
            <option value="">{!cat ? "Elegí categoría" : loadingTeams ? "Cargando…" : teams.length ? "Elegí tu club" : "Sin datos (tocá Actualizar)"}</option>
            {teams.map((t) => <option key={t.key} value={t.key}>{t.nombre}</option>)}
          </select>
        </div>

        <div>
          <p className="mb-2 font-display text-xl">3. Club rival</p>
          <select className={selectCls} value={b} onChange={(e) => setB(e.target.value)} disabled={!cat || loadingTeams}>
            <option value="">Elegí el rival</option>
            {teams.filter((t) => t.key !== a).map((t) => <option key={t.key} value={t.key}>{t.nombre}</option>)}
          </select>
        </div>

        <button
          onClick={onPredict}
          disabled={!a || !b || loading}
          className="w-full rounded-2xl bg-accent py-5 font-display text-2xl text-accent-foreground shadow-pop transition active:translate-y-1 disabled:opacity-50"
        >
          {loading ? "Calculando… 🤔" : "Predecir partido"}
        </button>
      </section>

      {msg && <p className="mt-4 rounded-2xl bg-card/90 p-3 text-center font-bold text-card-foreground">{msg}</p>}

      {pred && (
        <section className="mt-6 space-y-5 rounded-3xl bg-card p-5 text-card-foreground shadow-card animate-in fade-in slide-in-from-bottom-4">
          {pred.pocosDatos && (
            <div className="rounded-2xl bg-warn p-3 text-sm font-bold text-warn-foreground">
              ⚠️ Pocos datos: algún equipo jugó menos de 3 partidos. Pronóstico poco confiable.
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <Shield tone="a" />
              <span className="text-sm font-black leading-tight">{pred.nombreA}</span>
            </div>
            <div className="rounded-2xl bg-secondary px-4 py-2 font-display text-5xl text-secondary-foreground">
              {pred.marcador.a}<span className="mx-1 opacity-60">-</span>{pred.marcador.b}
            </div>
            <div className="flex flex-col items-center gap-1">
              <Shield tone="b" />
              <span className="text-sm font-black leading-tight">{pred.nombreB}</span>
            </div>
          </div>
          <p className="-mt-2 text-center text-xs text-muted-foreground">Marcador más probable</p>

          <div className="space-y-3">
            <Bar label={`Gana ${pred.nombreA}`} p={pred.probGana} cls="bg-win" />
            <Bar label="Empate" p={pred.probEmpata} cls="bg-draw" />
            <Bar label={`Gana ${pred.nombreB}`} p={pred.probPierde} cls="bg-loss" />
          </div>

          <div className="space-y-3 rounded-2xl bg-muted p-3">
            {[{ n: pred.nombreA, s: pred.statsA }, { n: pred.nombreB, s: pred.statsB }].map(({ n, s }) => (
              <div key={n}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">{n}</span>
                  <Forma f={s.forma} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.pj} PJ · {s.pg}G {s.pe}E {s.pp}P · {s.promGF.toFixed(1)} goles a favor / {s.promGC.toFixed(1)} en contra
                </p>
              </div>
            ))}
            {pred.h2h.partidos > 0 && (
              <p className="text-xs"><b>Cara a cara:</b> {pred.h2h.resultados.join(", ")}</p>
            )}
            {pred.comunes.length > 0 && (
              <p className="text-xs"><b>Rivales en común:</b> {pred.comunes.length}</p>
            )}
          </div>

          <div className="rounded-2xl border-4 border-dashed border-secondary p-4">
            <p className="mb-1 font-display text-lg">🎙️ El relator dice…</p>
            <p className="leading-relaxed">{pred.texto ?? "No pudimos generar el comentario esta vez, pero los números de arriba son el pronóstico."}</p>
          </div>
        </section>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={onSync}
          disabled={syncing}
          className="rounded-2xl border-4 border-chalk px-6 py-3 font-display text-lg text-chalk transition active:translate-y-1 disabled:opacity-60"
        >
          {syncing ? "Actualizando…" : "🔄 Actualizar datos"}
        </button>
        <p className="mt-2 text-xs opacity-80">Se actualiza solo todos los días.</p>
      </div>
    </main>
  );
}

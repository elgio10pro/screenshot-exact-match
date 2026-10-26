import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { categories, currentTeams, loadDataset, predictMatch, ZONA_NIVEL, type Dataset } from "@/lib/local-api";
import { relatorDetails } from "@/lib/relator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Predictor de Partidos – Fútbol Infantil" },
      { name: "description", content: "Pronóstico no oficial de partidos FEFI por categoría y zona, sumando resultados de Anual Apertura y Clausura." },
      { property: "og:title", content: "Predictor de Partidos – Fútbol Infantil" },
      { property: "og:description", content: "¿Cómo sale el partido? Probabilidades y marcador estimado para clubes FEFI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Prediction = ReturnType<typeof predictMatch> & { texto: string };

function Ball() {
  return <span className="ball-bounce inline-flex" aria-hidden><svg viewBox="0 0 40 40" className="ball-spin !h-8 !w-8"><circle cx="20" cy="20" r="18" className="fill-chalk stroke-secondary" strokeWidth="2"/><path d="M20 11 29 17 25 28 15 28 11 17Z M4 16 11 17 8 7 M29 17 36 16 32 7 M15 28 12 36 M25 28 28 36" className="fill-secondary stroke-secondary" strokeWidth="2"/></svg></span>;
}

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
  const [data, setData] = useState<Dataset | null>(null);
  const [cat, setCat] = useState("");
  const [zonaA, setZonaA] = useState("");
  const [zonaB, setZonaB] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pred, setPred] = useState<Prediction | null>(null);
  const previousOpening = useRef("");
  const version = useRef(0);
  const teams = data && cat ? currentTeams(data, cat) : [];
  const zones = ZONA_NIVEL.filter(z => teams.some(t => t.zona === z.zona));
  useEffect(() => { loadDataset().then(setData).catch(e => setMsg(e.message)); }, []);
  function resetResult() { version.current++; setPred(null); setLoading(false); setMsg(null); }
  async function onSync() {
    setSyncing(true); setMsg(null);
    try { setData(await loadDataset()); resetResult(); setA(""); setB(""); setZonaA(""); setZonaB(""); setMsg("¡Listo! Datos actualizados."); }
    catch { setMsg("No pudimos cargar los equipos."); }
    finally { setSyncing(false); }
  }
  async function onPredict() {
    const teamA = teams.find(t => t.key === a), teamB = teams.find(t => t.key === b);
    if (!data || !teamA || !teamB || a === b) return;
    const request = ++version.current;
    setLoading(true); setPred(null); setMsg(null);
    try {
      const p = predictMatch(data, cat, teamA, teamB);
      const text = relatorDetails({ ...p, anteriorApertura: previousOpening.current });
      await new Promise(resolve => setTimeout(resolve, 1400));
      if (request !== version.current) return;
      previousOpening.current = text.apertura;
      setPred({ ...p, texto: text.texto });
    } catch(e) { if (request === version.current) setMsg(e instanceof Error ? e.message : "No pudimos calcular el pronóstico."); }
    finally { if (request === version.current) setLoading(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-16 pt-8">
      <header className="mb-6 text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="font-display text-4xl leading-tight text-chalk drop-shadow">Predictor de Partidos</h1>
        <p className="font-display text-xl text-primary">Fútbol Infantil · FEFI</p>
        <p className="mt-1 text-xs opacity-80">App no oficial · datos del Torneo Anual 2026</p>
      </header>

      <section className="space-y-5 rounded-3xl bg-card p-5 text-card-foreground shadow-card">
        <div>
          <p className="mb-2 font-display text-xl">1. Categoría</p>
          <div className="grid grid-cols-4 gap-2">
            {(data ? categories(data) : []).map((c) => (
              <Button
                variant="ghost"
                key={c}
                onClick={() => { resetResult(); setCat(c); setZonaA(""); setZonaB(""); setA(""); setB(""); }}
                className={`h-auto rounded-2xl border-4 px-1 py-3 font-display text-2xl transition active:translate-y-1 ${
                  cat === c ? "border-secondary bg-primary text-primary-foreground shadow-pop" : "border-border bg-muted"
                }`}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>

        {([{ title: "2. Equipo 1 (mi equipo)", zona: zonaA, key: a, other: b, setZona: setZonaA, setKey: setA }, { title: "3. Equipo 2 (rival)", zona: zonaB, key: b, other: a, setZona: setZonaB, setKey: setB }]).map((side, i) => (
          <div key={side.title} className="space-y-2">
            <p className="font-display text-xl">{side.title}</p>
            <label htmlFor={`zona-${i}`} className="block font-bold">Zona</label>
            <select id={`zona-${i}`} className={selectCls} value={side.zona} disabled={!cat || loading} onChange={e => { resetResult(); side.setZona(e.target.value); side.setKey(""); }}>
              <option value="">{!cat ? "Elegí categoría" : "Elegí zona"}</option>
              {zones.map(z => <option key={z.zona} value={z.zona}>Zona {z.zona} · nivel {z.nivel}</option>)}
            </select>
            <label htmlFor={`equipo-${i}`} className="block font-bold">Equipo</label>
            <select id={`equipo-${i}`} className={selectCls} value={side.key} disabled={!side.zona || loading} onChange={e => { resetResult(); side.setKey(e.target.value); }}>
              <option value="">{!side.zona ? "Elegí zona" : "Elegí equipo"}</option>
              {teams.filter(t => t.zona === side.zona && t.pj > 0 && t.key !== side.other).map(t => <option key={t.key} value={t.key}>{t.nombre} · {t.pj} PJ</option>)}
            </select>
          </div>
        ))}

        <Button
          variant="ghost"
          onClick={onPredict}
          disabled={!a || !b || loading}
          className="h-auto min-h-20 w-full whitespace-normal rounded-2xl bg-accent hover:bg-accent/90 py-5 font-display text-2xl text-accent-foreground shadow-pop transition active:translate-y-1 disabled:opacity-50"
        >
          {loading ? <><Ball /><span>Pateando el pronóstico…</span></> : "Predecir partido"}
        </Button>
      </section>

      {msg && <p className="mt-4 rounded-2xl bg-card/90 p-3 text-center font-bold text-card-foreground">{msg}</p>}

      {loading && <div role="status" className="mt-6 flex min-h-40 items-center justify-center gap-3 rounded-3xl bg-card p-5 font-display text-xl text-card-foreground"><Ball />Pateando el pronóstico…</div>}

      {pred && (
        <section className="mt-6 space-y-5 rounded-3xl bg-card p-5 text-card-foreground shadow-card animate-in fade-in slide-in-from-bottom-4">
          {pred.zonaA !== pred.zonaB && <div className="rounded-2xl bg-warn p-3 text-sm font-bold text-warn-foreground">Equipos de divisiones distintas ({pred.diferenciaNivel} divisiones de diferencia): el pronóstico pesa mucho la diferencia de nivel entre zonas.</div>}
          {pred.pocosDatos && (
            <div className="rounded-2xl bg-warn p-3 text-sm font-bold text-warn-foreground">
              ⚠️ Pocos datos: algún equipo jugó menos de 3 partidos. Pronóstico poco confiable.
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div className="flex flex-col items-center gap-1">
              <Shield tone="a" />
              <span className="text-sm font-black leading-tight">{pred.nombreA}</span>
              <span className="text-xs">Zona {pred.zonaA} · división {pred.nivelA}</span>
            </div>
            <div className="rounded-2xl bg-secondary px-4 py-2 font-display text-5xl text-secondary-foreground">
              {pred.marcador.a}<span className="mx-1 opacity-60">-</span>{pred.marcador.b}
            </div>
            <div className="flex flex-col items-center gap-1">
              <Shield tone="b" />
              <span className="text-sm font-black leading-tight">{pred.nombreB}</span>
              <span className="text-xs">Zona {pred.zonaB} · división {pred.nivelB}</span>
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
        <Button
          variant="ghost"
          onClick={onSync}
          disabled={syncing}
          className="h-auto whitespace-normal rounded-2xl border-4 border-chalk px-6 py-3 font-display text-lg text-chalk transition active:translate-y-1 disabled:opacity-60"
        >
          {syncing ? "Actualizando…" : "🔄 Actualizar datos"}
        </Button>
        <p className="mt-2 text-xs opacity-80">Se actualiza solo todos los días.</p>
      </div>
    </main>
  );
}

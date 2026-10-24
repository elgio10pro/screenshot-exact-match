// Pure helpers: team-name normalization and FEFI HTML parsing (no DOM needed).

export function normalizeTeam(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,'"´`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Join runs of single letters: "s f c brandsen" -> "sfc brandsen"
  const out: string[] = [];
  let buf = "";
  for (const tok of base.split(" ")) {
    if (tok.length === 1 && /[a-z]/.test(tok)) buf += tok;
    else {
      if (buf) out.push(buf);
      buf = "";
      out.push(tok);
    }
  }
  if (buf) out.push(buf);
  return out.join(" ");
}

export type ParsedMatch = {
  torneo: string;
  anio: number;
  fecha_nro: number;
  fecha_dia: string | null;
  sede: string;
  hora: string;
  categoria: number;
  equipo_local: string;
  equipo_visitante: string;
  goles_local: number | null;
  goles_visitante: number | null;
};

function decode(s: string | undefined): string {
  s = s ?? "";
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#0?39;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

const toGoal = (s: string | undefined): number | null => {
  const t = decode(s);
  return /^\d+$/.test(t) ? Number(t) : null;
};

export function parseFefiHtml(html: string, torneo = "Copa de Campeones", anioDefault = 2026): ParsedMatch[] {
  const token = /<h2[^>]*class="copa-title"[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*class="sede-title"[^>]*>([\s\S]*?)<\/h3>|<table[^>]*class="copa-table"[^>]*>([\s\S]*?)<\/table>/g;
  const out: ParsedMatch[] = [];
  let fechaNro = 0;
  let fechaDia: string | null = null;
  let anio = anioDefault;
  let sede = "";
  let m: RegExpExecArray | null;
  while ((m = token.exec(html))) {
    if (m[1] !== undefined) {
      const title = decode(m[1]);
      const fm = /Fecha\s*(\d+)/i.exec(title);
      fechaNro = fm ? Number(fm[1]) : 0;
      const ym = /^(\d{4})/.exec(title);
      if (ym) anio = Number(ym[1]);
      const parts = title.split(/\s*[–-]\s*/);
      fechaDia = parts.length ? parts[parts.length - 1] || null : null;
      sede = "";
    } else if (m[2] !== undefined) {
      sede = decode(m[2]);
    } else if (m[3] !== undefined && fechaNro > 0) {
      const body = m[3].replace(/<thead[\s\S]*?<\/thead>/, "");
      const rows = body.match(/<tr[\s\S]*?<\/tr>/g) ?? [];
      for (const row of rows) {
        const cells: string[] = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1] ?? "");
        if (cells.length < 6) continue;
        const categoria = Number(decode(cells[1]));
        const local = decode(cells[2]);
        const visit = decode(cells[5]);
        if (!categoria || !local || !visit) continue;
        const gl = toGoal(cells[3]);
        const gv = toGoal(cells[4]);
        const both = gl !== null && gv !== null;
        out.push({
          torneo,
          anio,
          fecha_nro: fechaNro,
          fecha_dia: fechaDia,
          sede,
          hora: decode(cells[0]),
          categoria,
          equipo_local: local,
          equipo_visitante: visit,
          goles_local: both ? gl : null,
          goles_visitante: both ? gv : null,
        });
      }
    }
  }
  return out;
}

// ---------- Torneo Anual Baby Fútbol (zonas) ----------

export const ANUAL_ZONAS: { id: number; nombre: string }[] = [
  ..."12345678".split("").map((n, i) => ({ id: i + 1, nombre: n })),
  ..."ABCDEFGHIJKL".split("").map((n, i) => ({ id: i + 9, nombre: n })),
  ...["Blanca", "Bordo", "Celeste", "Oro", "Verde", "Violeta"].map((n, i) => ({ id: i + 21, nombre: n })),
];

export type AnualMatch = ParsedMatch & { cat: string; zona: string; estado: string | null };

/** Digits-only int for the legacy integer categoria column ("2014/15" -> 201415). */
export const catToInt = (cat: string) => Number(cat.replace(/\D/g, "").slice(0, 9)) || 0;

export function parseAnualHtml(html: string, torneo: string, zona: string, anio = 2026): AnualMatch[] {
  const out: AnualMatch[] = [];
  const sections = html.split(/<section class="fefit-fecha"/).slice(1);
  for (const sec of sections) {
    const fecha_nro = Number(/data-panel="(\d+)"/.exec(sec)?.[1] ?? 0);
    if (!fecha_nro) continue;
    const dia = decode(/fefit-fecha__titulo[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/.exec(sec)?.[1]).replace(/^·\s*/, "") || null;
    for (const art of sec.split(/<article class="fefit-partido"/).slice(1)) {
      const table = /<table class="fefit-res">([\s\S]*?)<\/table>/.exec(art)?.[1];
      if (!table) continue;
      const estado = decode(/fefit-estado"[^>]*>([^<]*)</.exec(table)?.[1]) || null;
      const cats = [...table.matchAll(/title="Categoría ([^"]+)"/g)].map((m) => decode(m[1]));
      const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table)?.[1] ?? "";
      const rows = (body.match(/<tr[\s\S]*?<\/tr>/g) ?? []).map((tr) => ({
        name: decode(/<span class="fefit-eq">[\s\S]*?<span>([\s\S]*?)<\/span>/.exec(tr)?.[1]),
        cells: [...tr.matchAll(/<td class="fefit-res__c[^"]*"[^>]*>([\s\S]*?)<\/td>/g)].map((m) => decode(m[1])),
      }));
      const [L, V] = rows;
      if (!L?.name || !V?.name) continue;
      cats.forEach((cat, i) => {
        const gl = /^\d+$/.test(L.cells[i] ?? "") ? Number(L.cells[i]) : null;
        const gv = /^\d+$/.test(V.cells[i] ?? "") ? Number(V.cells[i]) : null;
        const both = gl !== null && gv !== null;
        out.push({
          torneo, anio, fecha_nro, fecha_dia: dia, sede: "", hora: "",
          categoria: catToInt(cat), cat, zona, estado,
          equipo_local: L.name, equipo_visitante: V.name,
          goles_local: both ? gl : null, goles_visitante: both ? gv : null,
        });
      });
    }
  }
  return out;
}

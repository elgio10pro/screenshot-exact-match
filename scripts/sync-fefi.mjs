#!/usr/bin/env node
// Downloads the results from fefi.com.ar and writes public/data/matches.json.
//
//   node scripts/sync-fefi.mjs -> Anual Apertura + Clausura (18 zonas)
//
// Needs Node 22.18 or newer (it reads the TypeScript parser in src/lib directly).
// If a club shows up twice with different spellings, add a line to
// scripts/team-aliases.json:  { "nombre normalizado repetido": "nombre normalizado correcto" }

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ANUAL_ZONAS, normalizeTeam, parseAnualHtml } from "../src/lib/fefi-parse.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "data", "matches.json");
const ALIASES = path.join(ROOT, "scripts", "team-aliases.json");

const ANUAL_API = "https://fefi.com.ar/wp-json/fefit/v1/vista";
const VISTAS = [
  { vista: "fechas-apertura", torneo: "Anual Apertura" },
  { vista: "fechas-clausura", torneo: "Anual Clausura" },
];
const HEADERS = { "User-Agent": "Mozilla/5.0 (predictor-fefi)" };

/**
 * Pure step (no network): parsed matches -> compact dataset.
 * @param {Array<Array<object>>} units  one array of parsed matches per downloaded page
 * @param {Record<string,string>} aliases  alias key -> canonical key
 */
export function buildDataset(units, aliases = {}) {
  const canon = (name) => {
    const k = normalizeTeam(name);
    return aliases[k] ?? k;
  };
  const rows = new Map();
  const spellings = new Map(); // canonical key -> Map(spelling -> times seen)

  for (const unit of units) {
    for (const p of unit) {
      const lk = canon(p.equipo_local);
      const vk = canon(p.equipo_visitante);
      for (const [k, n] of [[lk, p.equipo_local], [vk, p.equipo_visitante]]) {
        const s = spellings.get(k) ?? new Map();
        s.set(n, (s.get(n) ?? 0) + 1);
        spellings.set(k, s);
      }
      const cat = p.cat ?? String(p.categoria);
      const zona = p.zona ?? "";
      const id = [p.torneo, p.anio, zona, p.fecha_nro, p.sede, p.hora, cat, lk, vk].join("|");
      const m = { t: p.torneo, f: p.fecha_nro, c: cat, lk, vk, gl: p.goles_local, gv: p.goles_visitante };
      if (zona) m.z = zona;
      rows.set(id, m);
    }
  }

  // Display name = the spelling FEFI uses most for that club.
  const names = {};
  for (const [k, s] of [...spellings.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    names[k] = [...s.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  const matches = [...rows.values()].sort(
    (a, b) => a.t.localeCompare(b.t) || (a.z ?? "").localeCompare(b.z ?? "") || a.c.localeCompare(b.c) || a.f - b.f || a.lk.localeCompare(b.lk),
  );
  return { names, matches };
}

async function get(url, as) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === "json" ? await res.json() : await res.text();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw new Error(`No se pudo leer ${url}: ${lastError?.message ?? lastError}`);
}

async function main() {
  const aliases = existsSync(ALIASES) ? JSON.parse(await readFile(ALIASES, "utf8")) : {};

  const units = [];
    for (const z of ANUAL_ZONAS) {
      for (const v of VISTAS) {
        try {
          const json = await get(`${ANUAL_API}?torneo=1&zona=${z.id}&vista=${v.vista}`, "json");
          const parsed = parseAnualHtml(json.html ?? "", v.torneo, z.nombre);
          units.push(parsed);
          console.log(`Zona ${z.nombre} · ${v.torneo}: ${parsed.length} partidos`);
        } catch (e) {
          throw new Error(`Zona ${z.nombre} ${v.torneo}: ${e.message}. Se conserva el archivo anterior.`);
        }
      }
    }

  const next = buildDataset(units, aliases);
  if (!next.matches.length) throw new Error("No llegaron partidos anuales; se conserva el archivo anterior");

  let previous = null;
  if (existsSync(OUT)) {
    try {
      previous = JSON.parse(await readFile(OUT, "utf8"));
    } catch {
      previous = null;
    }
  }
  const same = previous && JSON.stringify({ n: previous.names, m: previous.matches }) === JSON.stringify({ n: next.names, m: next.matches });
  if (same) {
    console.log("Sin cambios: el archivo de datos ya estaba al día.");
    return;
  }

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), ...next }) + "\n");
  const jugados = next.matches.filter((m) => m.gl !== null && m.gv !== null).length;
  console.log(`Listo: ${next.matches.length} partidos (${jugados} con resultado), ${Object.keys(next.names).length} equipos -> public/data/matches.json`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}

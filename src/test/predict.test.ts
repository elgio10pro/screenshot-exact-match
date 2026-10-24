import { describe, it, expect } from "vitest";
import { normalizeTeam, parseFefiHtml } from "@/lib/fefi-parse";
import { poissonOutcome, smoothRate, predict } from "@/lib/predict";

describe("normalizeTeam", () => {
  it("unifies S.F.C. Brandsen spellings", () => {
    expect(normalizeTeam("S.F.C. Brandsen")).toBe(normalizeTeam("S. F. C.  Brandsen"));
    expect(normalizeTeam("S.F.C. Brandsen")).toBe("sfc brandsen");
  });
  it("removes accents", () => {
    expect(normalizeTeam("Unión Ñandú")).toBe("union nandu");
  });
});

describe("parser", () => {
  const html = `<h2 class="copa-title">2026 &#8211; Fecha 3 &#8211; 5 de Abril</h2><h3 class="sede-title">Sede X</h3>
  <table class="copa-table"><thead><tr><th>Hora</th></tr></thead><tbody>
  <tr><td>13:30</td><td>18</td><td>A</td><td>5</td><td>2</td><td>B</td></tr>
  <tr><td>14:30</td><td>17</td><td>C</td><td></td><td></td><td>D</td></tr></tbody></table>`;
  it("reads fecha, sede and pending matches as null", () => {
    const r = parseFefiHtml(html);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ fecha_nro: 3, sede: "Sede X", categoria: 18, goles_local: 5, goles_visitante: 2 });
    expect(r[1]?.goles_local).toBeNull();
  });
});

describe("model", () => {
  it("probabilities sum to 1 and equal teams are symmetric", () => {
    const o = poissonOutcome(2, 2);
    expect(o.win + o.draw + o.loss).toBeCloseTo(1);
    expect(o.win).toBeCloseTo(o.loss);
  });
  it("a team with no games gets the category mean", () => {
    expect(smoothRate(0, 0, 2.5)).toBe(2.5);
  });
  it("flags few data under 3 matches", () => {
    const rows = [{ fecha_nro: 1, categoria: 12, local_key: "a", visitante_key: "b", goles_local: 3, goles_visitante: 1 }];
    expect(predict(rows, "a", "b").pocosDatos).toBe(true);
  });
});

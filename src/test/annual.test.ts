import { describe, it, expect } from 'vitest';
import { predict, LAMBDA_MAX, LAMBDA_MIN, NIVEL_PASO, SMOOTH_K, POISSON_MAX, type MatchRow } from '@/lib/predict';
import { currentTeams, categories, predictMatch, type Dataset } from '@/lib/local-api';
import { relator, relatorDetails, scenario, OPENINGS, ENDINGS, type Scenario, type RelatorInput } from '@/lib/relator';
const rows: MatchRow[] = ['A','F','K'].flatMap((zona,i) => Array.from({length:6},(_,j)=>({fecha_nro:j+1,categoria:2013,zona,torneo:'Anual Apertura',local_key:`t${i}`,visitante_key:`r${i}`,goles_local:3,goles_visitante:3})));
const p=predict(rows,'t0','r0',{zona:'A',nivel:1},{zona:'A',nivel:1});
const input:RelatorInput={...p,nombreA:'Unión',nombreB:'Brandsen'};
describe('annual zone model',()=>{
 it('keeps requested constants',()=>{ expect([NIVEL_PASO,SMOOTH_K,LAMBDA_MIN,LAMBDA_MAX,POISSON_MAX]).toEqual([.12,3,.05,12,25]); });
 it('identical teams in same zone are symmetric',()=>expect(p.probGana).toBeCloseTo(p.probPierde));
 it('equal 3-goal stats, five divisions: better wins above 75%',()=>expect(predict(rows,'t0','t1',{zona:'A',nivel:1},{zona:'F',nivel:6}).probGana).toBeGreaterThan(.75));
 it('equal 3-goal stats, ten divisions: better wins above 95%',()=>expect(predict(rows,'t0','t2',{zona:'A',nivel:1},{zona:'K',nivel:11}).probGana).toBeGreaterThan(.95));
 it('always normalizes probabilities and clamps lambdas',()=>{
  for(let level=1;level<=18;level++) { const x=predict(rows,'t0','t2',{zona:'A',nivel:1},{zona:'K',nivel:level}); expect(x.probGana+x.probEmpata+x.probPierde).toBeCloseTo(1); for(const n of [x.golesEsperadosA,x.golesEsperadosB]) {expect(n).toBeLessThanOrEqual(12);expect(n).toBeGreaterThanOrEqual(.05);} }
 });
 it('merges tournaments, excludes Copa, Clausura is newer',()=>{
  const r:MatchRow[]=[{...rows[0],fecha_nro:20,local_key:'a',visitante_key:'b',goles_local:3,goles_visitante:0},{...rows[0],fecha_nro:1,torneo:'Anual Clausura',local_key:'a',visitante_key:'b',goles_local:0,goles_visitante:2},{...rows[0],torneo:'Copa de Campeones',local_key:'a',visitante_key:'b',goles_local:99,goles_visitante:0}];
  const x=predict(r,'a','b',{zona:'A',nivel:1}); expect(x.statsA.pj).toBe(2);expect(x.statsA.gf).toBe(3);expect(x.statsA.forma).toEqual(['D','V']);expect(x.pocosDatos).toBe(true);
 });
 it('all zero scores remain finite',()=>{const x=predict(rows.map(r=>({...r,goles_local:0,goles_visitante:0})),'t0','r0',{zona:'A',nivel:1});expect(Number.isFinite(x.probEmpata)).toBe(true);});
});
describe('local team catalog',()=>{
 const data:Dataset={updatedAt:'',names:{a:'A',b:'B',c:'C',d:'D'},matches:[{t:'Anual Apertura',f:20,c:'2013',lk:'a',vk:'b',gl:3,gv:1,z:'A'},{t:'Anual Clausura',f:1,c:'2013',lk:'a',vk:'b',gl:0,gv:2,z:'F'},{t:'Anual Apertura',f:1,c:'2014',lk:'c',vk:'d',gl:null,gv:null,z:'A'},{t:'Copa de Campeones',f:1,c:'12',lk:'c',vk:'d',gl:1,gv:1}]};
 it('categories come only from annual records',()=>expect(categories(data)).toEqual(['2013','2014']));
 it('assigns latest zone while summing played matches',()=>expect(currentTeams(data,'2013')[0]).toMatchObject({zona:'F',nivel:6,pj:2}));
 it('pending teams remain catalogued with zero games',()=>expect(currentTeams(data,'2014').every(t=>t.pj===0)).toBe(true));
 it('rejects the same team twice',()=>{const t=currentTeams(data,'2013')[0];expect(()=>predictMatch(data,'2013',t,t)).toThrow();});
});
describe('template relator',()=>{
 const cases:Record<Scenario,RelatorInput>={PALIZA:{...input,probGana:.92,probPierde:.03,probEmpata:.05},FAVORITO_CLARO:{...input,probGana:.75,probPierde:.15,probEmpata:.1},PAREJO:{...input,probGana:.4,probPierde:.38,probEmpata:.22},FAVORITO_LEVE:{...input,probGana:.6,probPierde:.25,probEmpata:.15},EMPATE_PROBABLE:{...input,probGana:.25,probPierde:.25,probEmpata:.5}};
 for(const [s,x] of Object.entries(cases)) it(`${s}: 200 reproducible seeds with no unresolved placeholders`,()=>{
  expect(scenario(x)).toBe(s);for(let i=0;i<200;i++){const seed=i/200;const text=relator(x,seed);expect(text.length).toBeGreaterThan(30);expect(text).not.toMatch(/[{}]/);expect(relator(x,seed)).toBe(text);expect(relatorDetails(x,seed).escenario).toBe(s);}
 });
 it('has minimum opening and ending counts',()=>{for(const [s,n] of Object.entries({PALIZA:15,FAVORITO_CLARO:10,PAREJO:10,FAVORITO_LEVE:8,EMPATE_PROBABLE:6})){expect(OPENINGS[s as Scenario].length).toBeGreaterThanOrEqual(n);expect(ENDINGS[s as Scenario].length).toBeGreaterThanOrEqual(n);}});
 it('does not repeat previous opening and preserves pure seeded behavior',()=>{const first=relatorDetails(input,.42);const next=relatorDetails({...input,anteriorApertura:first.apertura},.42);expect(next.apertura).not.toBe(first.apertura);});
 it('eight division difference triggers PALIZA',()=>expect(scenario({...input,diferenciaNivel:8})).toBe('PALIZA'));
});

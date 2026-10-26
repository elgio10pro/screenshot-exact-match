import type { predict } from './predict';
export type RelatorInput = ReturnType<typeof predict> & { nombreA: string; nombreB: string; anteriorApertura?: string };
export type Scenario = 'PALIZA' | 'FAVORITO_CLARO' | 'PAREJO' | 'FAVORITO_LEVE' | 'EMPATE_PROBABLE';
export function scenario(p: RelatorInput): Scenario {
  const favorito = Math.max(p.probGana, p.probPierde);
  if (favorito >= .9 || Math.abs(p.marcador.a-p.marcador.b) >= 4 || p.diferenciaNivel >= 8) return 'PALIZA';
  if (favorito >= .7) return 'FAVORITO_CLARO';
  // The catch-all FAVORITO_LEVE would make EMPATE_PROBABLE unreachable.
  if (p.probEmpata > Math.max(p.probGana, p.probPierde)) return 'EMPATE_PROBABLE';
  if (Math.abs(p.probGana-p.probPierde) < .1) return 'PAREJO';
  return 'FAVORITO_LEVE';
}
export const OPENINGS: Record<Scenario, string[]> = {
 PALIZA: [
 '{F} llega con números de clase magistral', '{F} tiene el pronóstico a todo ritmo de tribuna', 'Para frenar a {F}, {R} necesita una hazaña futbolera', 'La calculadora se puso la camiseta de {F}', 'Los números de {F} vienen tocando el bombo', '{F} marca el paso y el pronóstico sigue el baile', 'La previa pinta una cuesta bien empinada para {R}', '{F} aparece con ventaja de cancha grande', 'El pronóstico trae megáfono para anunciar a {F}', 'Los números de {F} entraron a la cancha con banda de música', '{R} tiene una montaña por delante según los datos', 'La previa de {F} viene con ritmo de vuelta olímpica', 'La balanza se inclinó fuerte hacia {F}', 'El marcador estimado pone a {F} en modo festival', 'La calculadora le puso alfombra futbolera a {F}'
 ],
 FAVORITO_CLARO: ['{F} llega de candidato, pero ojo que {R} sabe jugar a lo guapo', '{F} lleva la delantera en los números', 'La previa le guiña un ojo a {F}', '{F} tiene argumentos para llevar la iniciativa', 'Los datos señalan a {F} sin cerrar la puerta a {R}', '{F} llega con ventaja, no con el partido ganado', 'La calculadora empuja a {F} hacia adelante', '{F} arranca como candidato en esta previa', 'El pronóstico tiene a {F} un paso adelante', '{F} trae mejores números para este cruce'],
 PAREJO: ['Esto va a estar peleadísimo entre {A} y {B}', 'La calculadora no se anima a elegir entre {A} y {B}', '{A} y {B} llegan casi a la par', 'La previa entre {A} y {B} promete pulseada', 'Los números de {A} y {B} están cabeza a cabeza', 'Este cruce entre {A} y {B} no tiene dueño claro', '{A} y {B} comparten una previa bien ajustada', 'Acá la balanza entre {A} y {B} apenas se mueve', 'El pronóstico de {A} contra {B} viene finito', 'Se anuncia un mano a mano numérico entre {A} y {B}'],
 FAVORITO_LEVE: ['{F} saca una pequeña luz en la previa', '{F} tiene ventaja, pero apenas', 'La calculadora elige a {F} por poquito', '{R} está cerca de discutirle el pronóstico a {F}', '{F} asoma adelante sin despegarse', 'Este cruce le da un empujoncito a {F}', 'Los números favorecen ligeramente a {F}', '{F} lleva una ventaja que cabe en un suspiro'],
 EMPATE_PROBABLE: ['El empate pide pista entre {A} y {B}', 'La calculadora ve tablas entre {A} y {B}', 'El empate aparece primero en esta previa', '{A} y {B} tienen un reparto de puntos en el horizonte', 'El pronóstico se inclina por una igualdad', 'La previa de {A} y {B} apunta a un resultado compartido']
};
export const ENDINGS: Record<Scenario, string[]> = {
 PALIZA: ['El papel pone a {F} arriba, pero la cancha todavía tiene que hablar', 'Si se cumplen los números, {F} lleva el ritmo', '{R} necesitaría torcer fuerte esta previa', 'La estadística trae un bombo grande para {F}', 'No es sentencia, pero el pronóstico viene con voz de tribuna', 'Los números dejan a {F} con el cartel de protagonista', 'La pelota no firma pronósticos, aunque hoy señalan a {F}', 'La previa le pone un desafío enorme a {R}', 'El modelo no duda mucho al señalar a {F}', '{F} sale arriba en esta cuenta, falta jugarla', 'El marcador estimado inclina la cancha de papel', 'La diferencia numérica no vino a pasar desapercibida', 'Para {R}, cambiar esta cuenta sería toda una sorpresa', 'La estadística canta fuerte, la cancha tendrá la última palabra', 'El pronóstico de {F} vino con bombo y redoblante'],
 FAVORITO_CLARO: ['{F} tiene ventaja, pero que nadie dé el partido por cerrado', '{R} todavía puede discutir esta previa', 'El candidato es {F}, la respuesta queda en la cancha', 'La pelota siempre guarda espacio para una sorpresa', '{F} tiene mejores chances, no una garantía', 'El pronóstico marca rumbo, no escribe el resultado', 'Para {R} hay desafío, no puerta cerrada', '{F} encabeza la previa con argumentos', 'Ahora falta que los números se encuentren con la pelota', 'La cuenta favorece a {F}, sin silbato final'],
 PAREJO: ['Acá un gol puede cambiar toda la cuenta', 'No hay margen para cantar victoria antes de jugar', 'La pelota tendrá que desempatar esta previa', 'Los números dejan el cruce abierto de par en par', 'La cancha decidirá lo que la calculadora no separa', 'Un detalle puede inclinar este mano a mano', 'Hay partido para discutir cada pelota', 'El pronóstico no regala ninguna ventaja grande', 'Esta cuenta viene ajustada hasta el final', 'Prepará la garganta para un cruce bien peleado'],
 FAVORITO_LEVE: ['La ventaja es chiquita, el partido sigue abierto', '{R} tiene espacio para cambiar la cuenta', '{F} asoma adelante, pero sin alejarse', 'El pronóstico va de puntitas, no de desfile', 'La pelota puede mover esta pequeña diferencia', 'Acá el candidato tiene que confirmar la previa', 'La cuenta es favorable, no definitiva', 'Una sola jugada puede cambiar el panorama'],
 EMPATE_PROBABLE: ['El reparto de puntos encabeza la cuenta, no está asegurado', 'Un gol puede romper esta igualdad prevista', 'La cancha dirá si la balanza termina quieta', 'Los números proponen tablas y la pelota decidirá', 'El empate manda en la previa, no en el silbato final', 'Nadie tiene una victoria escrita en esta cuenta']
};
export const DATA: Record<'goles' | 'defensa' | 'buena' | 'mala' | 'h2h' | 'nivel', string[]> = {
 goles: ['{A} promedia {gfA} goles a favor y {B}, {gfB}', 'En ataque, los promedios son {gfA} para {A} y {gfB} para {B}', 'La cuenta ofensiva muestra {gfA} goles por partido para {A} y {gfB} para {B}', 'Los goles a favor por encuentro: {A}, {gfA}; {B}, {gfB}', '{A} trae {gfA} goles de promedio ofensivo frente a {gfB} de {B}', 'Las estadísticas de ataque anotan {gfA} para {A} y {gfB} para {B}', 'El promedio a favor de {A} es {gfA} y el de {B} es {gfB}', 'La producción ofensiva por partido es {gfA} de {A} y {gfB} de {B}'],
 defensa: ['{A} recibe {gcA} goles por partido y {B}, {gcB}', 'En defensa, {A} tiene un promedio de {gcA} y {B} de {gcB}', 'Los goles recibidos por encuentro son {gcA} para {A} y {gcB} para {B}', 'La cuenta defensiva marca {gcA} de {A} contra {gcB} de {B}', '{A} registra {gcA} goles en contra de promedio frente a {gcB} de {B}', 'Los números atrás muestran {gcA} para {A} y {gcB} para {B}', 'El promedio recibido por {A} es {gcA}; por {B}, {gcB}', 'La defensa tiene estos promedios en contra: {A}, {gcA}; {B}, {gcB}'],
 buena: ['{T} suma {v} victorias en sus últimos {n} partidos', 'La racha de {T} trae {v} triunfos en {n} encuentros', '{T} anotó {v} victorias en la ventana reciente de {n} partidos', 'Los últimos {n} partidos de {T} incluyen {v} triunfos', 'La forma reciente de {T} registra {v} victorias en {n} partidos', 'En su tramo más reciente, {T} ganó {v} de {n}', '{T} viene con {v} partidos ganados entre los últimos {n}', 'La racha ganadora de {T} cuenta {v} triunfos en {n} presentaciones'],
 mala: ['{T} suma {d} derrotas en sus últimos {n} partidos', 'La racha reciente de {T} incluye {d} caídas en {n} encuentros', 'Los últimos {n} partidos de {T} dejaron {d} derrotas', 'La cuenta reciente de {T} muestra {d} caídas entre {n} partidos', '{T} perdió {d} de sus últimos {n} encuentros', 'En la ventana reciente, {T} registra {d} derrotas de {n}', 'La forma de {T} trae {d} caídas entre los últimos {n}', 'El tramo reciente de {T} tiene {d} derrotas en {n} presentaciones'],
 h2h: ['Hay {h} enfrentamientos directos registrados', 'El cara a cara cuenta {h} partidos', 'Los registros guardan {h} cruces entre ambos', 'Estos equipos se cruzaron {h} veces en los datos', 'La cuenta compartida incluye {h} encuentros', 'Tenemos {h} partidos previos entre estos equipos', 'El historial disponible suma {h} cara a cara', 'Los datos permiten revisar {h} cruces directos'],
 nivel: ['Entre Zona {zonaA} y Zona {zonaB} hay {dif} divisiones de diferencia', 'La separación de nivel entre ambos es de {dif} divisiones', 'La cuenta entre zonas tiene {dif} divisiones de distancia', 'Los niveles {nivelA} y {nivelB} dejan {dif} divisiones de diferencia', 'El ajuste del modelo contempla {dif} divisiones entre las zonas', 'Este cruce conecta zonas separadas por {dif} divisiones', 'La diferencia entre las divisiones de {A} y {B} es {dif}', 'Los datos de zona aportan una distancia de {dif} divisiones']
};
const TAGS: Record<string, string[]> = {
 GOLES: ['Los goles esperados suman {lambda}: pinta movimiento en las redes', 'Con {lambda} goles esperados entre ambos, la cuenta viene ofensiva', 'El modelo suma {lambda} goles esperados y pide garganta lista', 'La proyección conjunta es de {lambda} goles: números con vocación de arco', 'Hay {lambda} goles esperados entre ambos, una previa de redes activas'],
 TRABADO: ['Los goles esperados suman {lambda}: la cuenta viene cerradita', 'Con {lambda} goles esperados, cada grito podría pesar mucho', 'La proyección de {lambda} goles apunta a un cruce trabado', 'Los {lambda} goles esperados pintan poco espacio en el marcador', 'La suma esperada de {lambda} goles propone un partido ajustado'],
 BATACAZO: ['Hay un David contra Goliat numérico: la división más baja conserva chances de sorpresa', 'Ojo con el batacazo: la división más baja tiene al menos un 25% de ganar', 'La diferencia de división no borra una chance de sorpresa de al menos 25%', 'El duelo de niveles guarda espacio para un David contra Goliat', 'La división más baja no está fuera de la cuenta: tiene al menos 25% de victoria'],
 POCOS_DATOS: ['Ojo: hay menos de tres partidos de alguno de los equipos y poca certeza', 'La muestra es chica: al menos un equipo todavía no llega a tres partidos', 'Tomá esta previa con cuidado: alguno tiene menos de tres partidos registrados', 'Faltan rodaje y datos: uno de los equipos no alcanza los tres partidos', 'La calculadora tiene poca muestra, con menos de tres partidos de algún equipo']
};
export function relatorDetails(p: RelatorInput, seed = Math.random()) {
 let state = Math.floor(Math.abs(seed % 1)*4294967296) >>> 0;
 const random = () => { state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; };
 const pick = (list: string[]) => list[Math.floor(random()*list.length)] ?? '';
 const sc = scenario(p), favA = p.probGana >= p.probPierde;
 const values: Record<string,string|number> = { A:p.nombreA, B:p.nombreB, F:favA?p.nombreA:p.nombreB, R:favA?p.nombreB:p.nombreA, zonaA:p.zonaA, zonaB:p.zonaB, nivelA:p.nivelA, nivelB:p.nivelB, dif:p.diferenciaNivel, gfA:p.statsA.promGF.toFixed(1), gfB:p.statsB.promGF.toFixed(1), gcA:p.statsA.promGC.toFixed(1), gcB:p.statsB.promGC.toFixed(1), h:p.h2h.partidos, lambda:(p.golesEsperadosA+p.golesEsperadosB).toFixed(1) };
 const render = (s:string) => s.replace(/\{(\w+)\}/g, (_,k:string) => String(values[k] ?? '')).replace(/[{}]/g,'') + '.';
 const openings = OPENINGS[sc].filter(s => render(s) !== p.anteriorApertura);
 const apertura = render(pick(openings));
 const available = [...DATA.goles, ...DATA.defensa];
 if(p.h2h.partidos) available.push(...DATA.h2h);
 if(p.zonaA !== p.zonaB) available.push(...DATA.nivel);
 // Render each team's streak before choosing, so statements never invent form.
 for (const [name,stats] of [[p.nombreA,p.statsA],[p.nombreB,p.statsB]] as const) {
   const v=stats.forma.filter(r=>r==='V').length, d=stats.forma.filter(r=>r==='D').length;
   const fill=(s:string)=>s.replace('{T}',name).replace('{n}',String(stats.forma.length)).replace('{v}',String(v)).replace('{d}',String(d));
   if(v>=3) available.push(...DATA.buena.map(fill));
   if(d>=3) available.push(...DATA.mala.map(fill));
 }
 const phrases=[apertura,render(pick(available))];
 const tags:string[]=[]; const total=p.golesEsperadosA+p.golesEsperadosB;
 if(total>=6) tags.push('GOLES'); if(total<=2.5) tags.push('TRABADO');
 if(p.diferenciaNivel>=3 && (p.nivelA>p.nivelB?p.probGana:p.probPierde)>=.25) tags.push('BATACAZO');
 if(p.pocosDatos) tags.push('POCOS_DATOS');
 if(tags.length) phrases.push(render(pick(TAGS[pick(tags)] ?? [])));
 phrases.push(render(pick(ENDINGS[sc])));
 return { texto:phrases.join(' '), apertura, escenario:sc };
}
export function relator(input: RelatorInput, seed = Math.random()) { return relatorDetails(input,seed).texto; }

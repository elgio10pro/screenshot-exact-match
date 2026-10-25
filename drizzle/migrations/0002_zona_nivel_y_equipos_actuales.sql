CREATE TABLE public.zona_nivel (
  zona text PRIMARY KEY,
  nivel int NOT NULL
);
GRANT SELECT ON public.zona_nivel TO anon;
GRANT SELECT ON public.zona_nivel TO authenticated;
GRANT ALL ON public.zona_nivel TO service_role;
ALTER TABLE public.zona_nivel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zona_nivel public read" ON public.zona_nivel FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.zona_nivel (zona, nivel) VALUES
  ('A', 1), ('B', 2), ('C', 3), ('D', 4), ('E', 5), ('F', 6),
  ('G', 7), ('H', 8), ('I', 9), ('J', 10), ('K', 11), ('L', 12),
  ('Blanca', 13), ('Bordo', 14), ('Celeste', 15), ('Oro', 16), ('Verde', 17), ('Violeta', 18);

CREATE VIEW public.equipos_actuales WITH (security_invoker = true) AS
WITH partidos AS (
  SELECT cat, local_key AS team_key, equipo_local AS nombre, zona, torneo, fecha_nro,
         (goles_local IS NOT NULL AND goles_visitante IS NOT NULL) AS jugado
  FROM public.matches
  WHERE torneo IN ('Anual Apertura', 'Anual Clausura')
  UNION ALL
  SELECT cat, visitante_key, equipo_visitante, zona, torneo, fecha_nro,
         (goles_local IS NOT NULL AND goles_visitante IS NOT NULL)
  FROM public.matches
  WHERE torneo IN ('Anual Apertura', 'Anual Clausura')
),
reciente AS (
  SELECT DISTINCT ON (cat, team_key) cat, team_key, nombre, zona
  FROM partidos
  ORDER BY cat, team_key, CASE torneo WHEN 'Anual Clausura' THEN 1 ELSE 0 END DESC, fecha_nro DESC
),
jugados AS (
  SELECT cat, team_key, count(*) FILTER (WHERE jugado) AS pj
  FROM partidos
  GROUP BY cat, team_key
)
SELECT r.cat, r.team_key, r.nombre, r.zona, zn.nivel, j.pj
FROM reciente r
JOIN jugados j ON j.cat = r.cat AND j.team_key = r.team_key
LEFT JOIN public.zona_nivel zn ON zn.zona = r.zona;

GRANT SELECT ON public.equipos_actuales TO anon;
GRANT SELECT ON public.equipos_actuales TO authenticated;
GRANT ALL ON public.equipos_actuales TO service_role;

DELETE FROM public.matches WHERE torneo = 'Copa de Campeones' OR zona IN ('1', '2', '3', '4', '5', '6', '7', '8');
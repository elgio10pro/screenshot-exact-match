CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo text NOT NULL,
  anio int NOT NULL,
  fecha_nro int NOT NULL,
  fecha_dia text,
  sede text NOT NULL DEFAULT '',
  hora text NOT NULL DEFAULT '',
  categoria int NOT NULL,
  equipo_local text NOT NULL,
  equipo_visitante text NOT NULL,
  local_key text NOT NULL,
  visitante_key text NOT NULL,
  goles_local int,
  goles_visitante int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (torneo, anio, fecha_nro, sede, hora, categoria, local_key, visitante_key)
);
CREATE INDEX matches_cat_idx ON public.matches (categoria);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches public read" ON public.matches FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.team_aliases (
  alias_key text PRIMARY KEY,
  canonical_key text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.team_aliases TO anon, authenticated;
GRANT ALL ON public.team_aliases TO service_role;
ALTER TABLE public.team_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aliases public read" ON public.team_aliases FOR SELECT TO anon, authenticated USING (true);
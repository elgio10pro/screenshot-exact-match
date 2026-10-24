ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS cat text NOT NULL DEFAULT '';
UPDATE public.matches SET cat = categoria::text WHERE cat = '';
COMMENT ON COLUMN public.matches.categoria IS 'DEPRECATED for display: use cat (text, e.g. 2014/15). Still written as digits-only int.';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS zona text NOT NULL DEFAULT '';
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS estado text;
CREATE UNIQUE INDEX IF NOT EXISTS matches_unique_v2 ON public.matches (torneo, anio, zona, fecha_nro, sede, hora, cat, local_key, visitante_key);
CREATE INDEX IF NOT EXISTS matches_torneo_zona_cat_idx ON public.matches (torneo, zona, cat);

CREATE TABLE public.sync_state (
  id int PRIMARY KEY DEFAULT 1,
  next_unit int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sync_state TO service_role;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;
-- Protocolo das ocorrências: numeração global por ano (YYYY/0000)
-- Aplica-se a public.occurrences e public.porter_occurrences
-- Execute este SQL no Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.occurrence_protocol_counters (
  year int PRIMARY KEY,
  last_number int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.occurrence_protocol_counters ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.occurrence_protocol_counters TO authenticated;
GRANT ALL ON public.occurrence_protocol_counters TO service_role;

DROP POLICY IF EXISTS "Authenticated can read protocol counters" ON public.occurrence_protocol_counters;
CREATE POLICY "Authenticated can read protocol counters"
  ON public.occurrence_protocol_counters FOR SELECT TO authenticated USING (true);

ALTER TABLE public.occurrences        ADD COLUMN IF NOT EXISTS protocol_year   int;
ALTER TABLE public.occurrences        ADD COLUMN IF NOT EXISTS protocol_number int;
ALTER TABLE public.occurrences        ADD COLUMN IF NOT EXISTS protocol        text;

ALTER TABLE public.porter_occurrences ADD COLUMN IF NOT EXISTS protocol_year   int;
ALTER TABLE public.porter_occurrences ADD COLUMN IF NOT EXISTS protocol_number int;
ALTER TABLE public.porter_occurrences ADD COLUMN IF NOT EXISTS protocol        text;

CREATE UNIQUE INDEX IF NOT EXISTS occurrences_protocol_key
  ON public.occurrences (protocol) WHERE protocol IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS porter_occurrences_protocol_key
  ON public.porter_occurrences (protocol) WHERE protocol IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_occurrence_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_num  int;
BEGIN
  IF NEW.protocol IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_year := EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()))::int;

  INSERT INTO public.occurrence_protocol_counters(year, last_number)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.occurrence_protocol_counters.last_number + 1,
        updated_at  = now()
  RETURNING last_number INTO v_num;

  NEW.protocol_year   := v_year;
  NEW.protocol_number := v_num;
  NEW.protocol        := v_year::text || '/' || lpad(v_num::text, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_protocol ON public.occurrences;
CREATE TRIGGER trg_assign_protocol
  BEFORE INSERT ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION public.assign_occurrence_protocol();

DROP TRIGGER IF EXISTS trg_assign_protocol ON public.porter_occurrences;
CREATE TRIGGER trg_assign_protocol
  BEFORE INSERT ON public.porter_occurrences
  FOR EACH ROW EXECUTE FUNCTION public.assign_occurrence_protocol();

-- Backfill: numeração global por ano, ordenada cronologicamente
DO $$
DECLARE
  r record;
  v_year int := -1;
  v_num  int := 0;
BEGIN
  FOR r IN
    SELECT id, created_at, 'occurrences'::text AS src
      FROM public.occurrences WHERE protocol IS NULL
    UNION ALL
    SELECT id, created_at, 'porter_occurrences'::text AS src
      FROM public.porter_occurrences WHERE protocol IS NULL
    ORDER BY 2 ASC, 1 ASC
  LOOP
    IF EXTRACT(YEAR FROM r.created_at)::int <> v_year THEN
      v_year := EXTRACT(YEAR FROM r.created_at)::int;
      SELECT COALESCE(last_number, 0) INTO v_num
        FROM public.occurrence_protocol_counters WHERE year = v_year;
      v_num := COALESCE(v_num, 0);
    END IF;
    v_num := v_num + 1;

    IF r.src = 'occurrences' THEN
      UPDATE public.occurrences
         SET protocol_year = v_year,
             protocol_number = v_num,
             protocol = v_year::text || '/' || lpad(v_num::text, 4, '0')
       WHERE id = r.id;
    ELSE
      UPDATE public.porter_occurrences
         SET protocol_year = v_year,
             protocol_number = v_num,
             protocol = v_year::text || '/' || lpad(v_num::text, 4, '0')
       WHERE id = r.id;
    END IF;

    INSERT INTO public.occurrence_protocol_counters(year, last_number)
    VALUES (v_year, v_num)
    ON CONFLICT (year) DO UPDATE
      SET last_number = GREATEST(public.occurrence_protocol_counters.last_number, EXCLUDED.last_number),
          updated_at = now();
  END LOOP;
END $$;

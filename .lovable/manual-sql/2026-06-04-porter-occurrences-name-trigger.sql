-- Run in Supabase SQL Editor.
-- Garante que `registered_by_name` e `resolved_by_name` sejam preenchidos
-- automaticamente a partir da tabela profiles, evitando bloqueios de RLS
-- (porteiro não consegue ler profile do síndico, etc).

ALTER TABLE public.porter_occurrences
  ADD COLUMN IF NOT EXISTS registered_by_name text,
  ADD COLUMN IF NOT EXISTS resolved_by_name text;

CREATE OR REPLACE FUNCTION public.set_porter_occurrence_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.registered_by IS NOT NULL
     AND (NEW.registered_by_name IS NULL OR length(btrim(NEW.registered_by_name)) = 0) THEN
    SELECT full_name INTO NEW.registered_by_name
    FROM public.profiles
    WHERE user_id = NEW.registered_by
    LIMIT 1;
  END IF;

  IF NEW.resolved_by IS NOT NULL
     AND (NEW.resolved_by_name IS NULL OR length(btrim(NEW.resolved_by_name)) = 0) THEN
    SELECT full_name INTO NEW.resolved_by_name
    FROM public.profiles
    WHERE user_id = NEW.resolved_by
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_porter_occurrence_names ON public.porter_occurrences;
CREATE TRIGGER trg_set_porter_occurrence_names
BEFORE INSERT OR UPDATE OF registered_by, resolved_by, registered_by_name, resolved_by_name
ON public.porter_occurrences
FOR EACH ROW
EXECUTE FUNCTION public.set_porter_occurrence_names();

-- Backfill
UPDATE public.porter_occurrences po
SET registered_by_name = p.full_name
FROM public.profiles p
WHERE (po.registered_by_name IS NULL OR length(btrim(po.registered_by_name)) = 0)
  AND po.registered_by IS NOT NULL
  AND p.user_id = po.registered_by;

UPDATE public.porter_occurrences po
SET resolved_by_name = p.full_name
FROM public.profiles p
WHERE (po.resolved_by_name IS NULL OR length(btrim(po.resolved_by_name)) = 0)
  AND po.resolved_by IS NOT NULL
  AND p.user_id = po.resolved_by;

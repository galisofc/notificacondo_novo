-- Adiciona colunas denormalizadas para nome do responsável pelo cadastro e quem finalizou
-- Necessário porque RLS de profiles pode bloquear leituras cruzadas (porteiro x síndico).

ALTER TABLE public.porter_occurrences
  ADD COLUMN IF NOT EXISTS registered_by_name text,
  ADD COLUMN IF NOT EXISTS resolved_by_name text;

-- Backfill a partir de profiles (executar uma vez)
UPDATE public.porter_occurrences po
SET registered_by_name = p.full_name
FROM public.profiles p
WHERE po.registered_by_name IS NULL
  AND po.registered_by IS NOT NULL
  AND p.user_id = po.registered_by;

UPDATE public.porter_occurrences po
SET resolved_by_name = p.full_name
FROM public.profiles p
WHERE po.resolved_by_name IS NULL
  AND po.resolved_by IS NOT NULL
  AND p.user_id = po.resolved_by;

-- Normaliza todos os telefones de moradores para conter apenas dígitos.
-- Ex: "(11) 93018-5827" -> "11930185827"
-- Idempotente.
UPDATE public.residents
SET phone = regexp_replace(phone, '\D', '', 'g')
WHERE phone IS NOT NULL
  AND phone <> regexp_replace(phone, '\D', '', 'g');

-- Backfill: Preenche o full_name em registros antigos de banner_acknowledgments
-- usando o full_name da tabela profiles onde o full_name atual é nulo ou vazio
UPDATE public.banner_acknowledgments ba
SET full_name = p.full_name
FROM public.profiles p
WHERE ba.user_id = p.id
AND (ba.full_name IS NULL OR ba.full_name = '' OR ba.full_name = 'Porteiro');

-- Log de conclusão (opcional para rodar no editor SQL)
-- SELECT count(*) FROM public.banner_acknowledgments WHERE full_name IS NOT NULL;

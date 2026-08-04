-- Atualiza a função RPC para incluir o campo full_name da tabela de ciência
CREATE OR REPLACE FUNCTION public.get_banner_acknowledgments(_banner_id uuid)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    email text
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ba.user_id,
    COALESCE(ba.full_name, p.full_name) as full_name,
    p.email
  FROM public.banner_acknowledgments ba
  LEFT JOIN public.profiles p ON p.id = ba.user_id
  WHERE ba.banner_id = _banner_id;
$$;

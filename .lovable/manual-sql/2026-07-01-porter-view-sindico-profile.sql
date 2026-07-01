-- Execute no SQL Editor do Supabase para permitir que porteiros vejam
-- o avatar e nome do síndico (dono do condomínio) no livro de recados.

DROP POLICY IF EXISTS "Porteiros can view sindico profile of their condominiums" ON public.profiles;

CREATE POLICY "Porteiros can view sindico profile of their condominiums"
  ON public.profiles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'porteiro'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.condominiums c
      JOIN public.user_condominiums uc
        ON uc.condominium_id = c.id
      WHERE uc.user_id = auth.uid()
        AND c.owner_id = profiles.user_id
    )
  );

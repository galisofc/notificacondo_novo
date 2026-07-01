-- Permite ao porteiro ler o perfil (nome/avatar) de qualquer autor de recado
-- publicado nos condomínios em que ele trabalha. Cobre porteiros co-workers e
-- síndico, mesmo que a vinculação em user_condominiums não exista para o autor.

DROP POLICY IF EXISTS "Porteiros can view profiles of porter_messages authors" ON public.profiles;

CREATE POLICY "Porteiros can view profiles of porter_messages authors"
  ON public.profiles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'porteiro'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.porter_messages pm
      JOIN public.user_condominiums uc ON uc.condominium_id = pm.condominium_id
      WHERE uc.user_id = auth.uid()
        AND pm.author_id = profiles.user_id
    )
  );

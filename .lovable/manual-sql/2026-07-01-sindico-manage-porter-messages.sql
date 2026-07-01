-- Allow sindicos (condominium owners) to manage porter messages in their own condominiums.
-- Run once in the Supabase SQL Editor.

DROP POLICY IF EXISTS "Sindicos can manage messages of own condominiums" ON public.porter_messages;

CREATE POLICY "Sindicos can manage messages of own condominiums"
ON public.porter_messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = porter_messages.condominium_id
      AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.condominiums c
    WHERE c.id = porter_messages.condominium_id
      AND c.owner_id = auth.uid()
  )
);

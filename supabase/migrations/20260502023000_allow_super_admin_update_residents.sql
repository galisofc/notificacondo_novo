-- Allow super admins to update residents, including BSUID backfill from the admin UI.
-- Access is controlled server-side through the has_role() security definer function.
DROP POLICY IF EXISTS "Super admins can update residents" ON public.residents;

CREATE POLICY "Super admins can update residents"
ON public.residents
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

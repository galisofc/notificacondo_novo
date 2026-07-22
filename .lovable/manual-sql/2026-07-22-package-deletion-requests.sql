-- Feature: Package deletion requests (síndico approval flow)
-- Idempotent migration.

-- 1) Soft delete columns on packages
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 2) Requests table
CREATE TABLE IF NOT EXISTS public.package_deletion_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  condominium_id    uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  requested_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name text,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovada','rejeitada')),
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_by_name  text,
  review_notes      text,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pkg_del_req_condo_status
  ON public.package_deletion_requests (condominium_id, status);
CREATE INDEX IF NOT EXISTS idx_pkg_del_req_package
  ON public.package_deletion_requests (package_id);

-- 3) Grants
GRANT SELECT, INSERT, UPDATE ON public.package_deletion_requests TO authenticated;
GRANT ALL ON public.package_deletion_requests TO service_role;

-- 4) RLS
ALTER TABLE public.package_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pkg_del_req_select" ON public.package_deletion_requests;
CREATE POLICY "pkg_del_req_select"
ON public.package_deletion_requests
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR condominium_id IN (SELECT id FROM public.condominiums WHERE owner_id = auth.uid())
  OR public.user_belongs_to_condominium(auth.uid(), condominium_id)
);

DROP POLICY IF EXISTS "pkg_del_req_insert" ON public.package_deletion_requests;
CREATE POLICY "pkg_del_req_insert"
ON public.package_deletion_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR condominium_id IN (SELECT id FROM public.condominiums WHERE owner_id = auth.uid())
    OR public.user_belongs_to_condominium(auth.uid(), condominium_id)
  )
);

DROP POLICY IF EXISTS "pkg_del_req_update" ON public.package_deletion_requests;
CREATE POLICY "pkg_del_req_update"
ON public.package_deletion_requests
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR condominium_id IN (SELECT id FROM public.condominiums WHERE owner_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR condominium_id IN (SELECT id FROM public.condominiums WHERE owner_id = auth.uid())
);

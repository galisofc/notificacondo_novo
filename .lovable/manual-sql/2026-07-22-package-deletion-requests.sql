-- Feature: Package deletion requests (síndico approval flow)
-- Idempotent migration.
-- IMPORTANT: approval performs a REAL DELETE from public.packages.
-- The request record is preserved for audit by changing package_id FK to ON DELETE SET NULL
-- and storing a snapshot of the package destination before deleting the package row.

-- 1) Soft delete columns on packages
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

-- 2) Requests table
CREATE TABLE IF NOT EXISTS public.package_deletion_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id        uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  condominium_id    uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  requested_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name text,
  package_pickup_code text,
  package_block_name text,
  package_apartment_number text,
  package_condominium_name text,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovada','rejeitada')),
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_by_name  text,
  review_notes      text,
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Existing installations may have been created by an earlier version of this script.
ALTER TABLE public.package_deletion_requests
  ALTER COLUMN package_id DROP NOT NULL,
  ALTER COLUMN requested_by DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS package_pickup_code text,
  ADD COLUMN IF NOT EXISTS package_block_name text,
  ADD COLUMN IF NOT EXISTS package_apartment_number text,
  ADD COLUMN IF NOT EXISTS package_condominium_name text;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
    INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_schema = tc.constraint_schema
   AND kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
   AND kcu.table_name = tc.table_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'package_deletion_requests'
    AND kcu.column_name = 'package_id'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.package_deletion_requests DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.package_deletion_requests
    ADD CONSTRAINT package_deletion_requests_package_id_fkey
    FOREIGN KEY (package_id)
    REFERENCES public.packages(id)
    ON DELETE SET NULL;
END $$;

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

-- 5) Atomic approval helper: validates the logged-in síndico/super_admin,
-- stores package snapshot data, approves the request, and hard-deletes the package row.
CREATE OR REPLACE FUNCTION public.approve_package_deletion_request(
  _request_id uuid,
  _reviewer_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.package_deletion_requests%ROWTYPE;
  v_package record;
  v_deleted_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
    INTO v_request
  FROM public.package_deletion_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de exclusão não encontrada';
  END IF;

  IF v_request.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta solicitação já foi revisada';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'super_admin')
    OR v_request.condominium_id IN (
      SELECT id FROM public.condominiums WHERE owner_id = v_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar esta solicitação';
  END IF;

  SELECT
    p.id,
    p.pickup_code,
    c.name AS condominium_name,
    b.name AS block_name,
    a.number AS apartment_number
    INTO v_package
  FROM public.packages p
  LEFT JOIN public.condominiums c ON c.id = p.condominium_id
  LEFT JOIN public.blocks b ON b.id = p.block_id
  LEFT JOIN public.apartments a ON a.id = p.apartment_id
  WHERE p.id = v_request.package_id;

  IF v_package.id IS NULL THEN
    RAISE EXCEPTION 'Encomenda não encontrada no banco de dados';
  END IF;

  UPDATE public.package_deletion_requests
  SET
    status = 'aprovada',
    reviewed_by = v_user_id,
    reviewed_by_name = NULLIF(BTRIM(_reviewer_name), ''),
    reviewed_at = now(),
    package_pickup_code = COALESCE(package_pickup_code, v_package.pickup_code),
    package_condominium_name = COALESCE(package_condominium_name, v_package.condominium_name),
    package_block_name = COALESCE(package_block_name, v_package.block_name),
    package_apartment_number = COALESCE(package_apartment_number, v_package.apartment_number)
  WHERE id = _request_id;

  DELETE FROM public.packages
  WHERE id = v_package.id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count <> 1 THEN
    RAISE EXCEPTION 'A encomenda não foi excluída do banco de dados';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_package_id', v_package.id,
    'pickup_code', v_package.pickup_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_package_deletion_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_package_deletion_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_package_deletion_request(uuid, text) TO authenticated;

-- 6) Reconcile requests approved by the previous soft-delete implementation.
-- Re-running this script will also hard-delete packages from requests already marked as approved.
UPDATE public.package_deletion_requests r
SET
  package_pickup_code = COALESCE(r.package_pickup_code, p.pickup_code),
  package_condominium_name = COALESCE(r.package_condominium_name, c.name),
  package_block_name = COALESCE(r.package_block_name, b.name),
  package_apartment_number = COALESCE(r.package_apartment_number, a.number::text)
FROM public.packages p
LEFT JOIN public.condominiums c ON c.id = p.condominium_id
LEFT JOIN public.blocks b ON b.id = p.block_id
LEFT JOIN public.apartments a ON a.id = p.apartment_id
WHERE r.package_id = p.id
  AND r.status = 'aprovada';

DELETE FROM public.packages p
USING public.package_deletion_requests r
WHERE r.package_id = p.id
  AND r.status = 'aprovada';

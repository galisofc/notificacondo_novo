-- Run in Supabase SQL Editor.
-- Cadastro independente de Proprietários, vinculados a residents via FK.

-- 1) Tabela de proprietários (por condomínio)
CREATE TABLE IF NOT EXISTS public.property_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  cpf text,
  phone text,
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_owners_condominium_idx
  ON public.property_owners(condominium_id);

CREATE UNIQUE INDEX IF NOT EXISTS property_owners_cpf_condo_uidx
  ON public.property_owners(condominium_id, cpf) WHERE cpf IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_owners TO authenticated;
GRANT ALL ON public.property_owners TO service_role;

ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'property_owners'
      AND policyname = 'sindico manages owners'
  ) THEN
    CREATE POLICY "sindico manages owners" ON public.property_owners
      FOR ALL TO authenticated
      USING (
        public.has_role(auth.uid(), 'super_admin') OR
        EXISTS (
          SELECT 1 FROM public.condominiums c
          WHERE c.id = property_owners.condominium_id
            AND c.owner_id = auth.uid()
        )
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'super_admin') OR
        EXISTS (
          SELECT 1 FROM public.condominiums c
          WHERE c.id = property_owners.condominium_id
            AND c.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 2) FK no morador (ON DELETE SET NULL — preserva o proprietário ao excluir inquilino)
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS property_owner_id uuid
    REFERENCES public.property_owners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS residents_property_owner_idx
  ON public.residents(property_owner_id);

-- 3) Migração dos dados embutidos (apenas inquilinos com owner_phone)
INSERT INTO public.property_owners (condominium_id, full_name, phone, email)
SELECT DISTINCT a.condominium_id,
                COALESCE(r.owner_name, 'Proprietário'),
                r.owner_phone,
                r.owner_email
FROM public.residents r
JOIN public.apartments a ON a.id = r.apartment_id
WHERE r.resident_type = 'inquilino'
  AND r.owner_phone IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_owners po
    WHERE po.condominium_id = a.condominium_id
      AND po.phone = r.owner_phone
  );

UPDATE public.residents r
SET property_owner_id = po.id
FROM public.apartments a, public.property_owners po
WHERE r.apartment_id = a.id
  AND po.condominium_id = a.condominium_id
  AND po.phone = r.owner_phone
  AND r.property_owner_id IS NULL
  AND r.owner_phone IS NOT NULL;

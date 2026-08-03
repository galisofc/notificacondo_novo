-- Banners com imagem + modal de ciência por porteiro
-- Execute no SQL Editor do Supabase (idempotente)

-- 1) Novas colunas em condominium_banners
ALTER TABLE public.condominium_banners
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS show_as_modal BOOLEAN NOT NULL DEFAULT true;

-- 2) Tabela de ciência (acknowledgment) por usuário
CREATE TABLE IF NOT EXISTS public.banner_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_id UUID NOT NULL REFERENCES public.condominium_banners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (banner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_banner_ack_user ON public.banner_acknowledgments(user_id);
CREATE INDEX IF NOT EXISTS idx_banner_ack_banner ON public.banner_acknowledgments(banner_id);

GRANT SELECT, INSERT, DELETE ON public.banner_acknowledgments TO authenticated;
GRANT ALL ON public.banner_acknowledgments TO service_role;

ALTER TABLE public.banner_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own acknowledgments" ON public.banner_acknowledgments;
CREATE POLICY "Users can view own acknowledgments"
ON public.banner_acknowledgments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'sindico') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users can insert own acknowledgments" ON public.banner_acknowledgments;
CREATE POLICY "Users can insert own acknowledgments"
ON public.banner_acknowledgments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own acknowledgments" ON public.banner_acknowledgments;
CREATE POLICY "Users can delete own acknowledgments"
ON public.banner_acknowledgments FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'sindico') OR public.has_role(auth.uid(), 'super_admin'));

-- 3) Bucket público para imagens dos banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read banners images" ON storage.objects;
CREATE POLICY "Public read banners images"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated upload banners images" ON storage.objects;
CREATE POLICY "Authenticated upload banners images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated update banners images" ON storage.objects;
CREATE POLICY "Authenticated update banners images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Authenticated delete banners images" ON storage.objects;
CREATE POLICY "Authenticated delete banners images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banners');

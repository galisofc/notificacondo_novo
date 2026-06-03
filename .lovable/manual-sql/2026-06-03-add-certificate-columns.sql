-- Rodar no SQL Editor do Supabase Dashboard.
-- Adiciona colunas necessárias para o certificado digital ICP-Brasil do síndico.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_url text;

-- Força o PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';

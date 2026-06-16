-- Run in Supabase SQL Editor.
-- Responsável por advertência/multa: distinção inquilino x proprietário
-- e suporte a notificação para ambos.

-- 1) Campos no morador para registrar dados do proprietário (quando o morador é inquilino)
ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS resident_type text NOT NULL DEFAULT 'proprietario',
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS owner_email text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'residents_resident_type_check'
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_resident_type_check
      CHECK (resident_type IN ('proprietario', 'inquilino'));
  END IF;
END $$;

-- 2) Snapshot do responsável no momento da decisão
ALTER TABLE public.occurrences
  ADD COLUMN IF NOT EXISTS responsible_party text,
  ADD COLUMN IF NOT EXISTS responsible_name text,
  ADD COLUMN IF NOT EXISTS responsible_phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'occurrences_responsible_party_check'
  ) THEN
    ALTER TABLE public.occurrences
      ADD CONSTRAINT occurrences_responsible_party_check
      CHECK (responsible_party IS NULL OR responsible_party IN ('inquilino', 'proprietario'));
  END IF;
END $$;

-- 3) Log de notificações: identificar destinatário (inquilino x proprietário)
ALTER TABLE public.whatsapp_notification_logs
  ADD COLUMN IF NOT EXISTS recipient_role text;

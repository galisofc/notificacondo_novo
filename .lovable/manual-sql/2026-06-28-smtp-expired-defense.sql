-- ============================================================
-- SMTP + Envio de multas expiradas para a administradora
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1) Tabela de configuração SMTP (gerenciada pelo Super Admin)
CREATE TABLE IF NOT EXISTS public.smtp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host TEXT NOT NULL,
  port INT NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT 'NotificaCondo',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smtp_config TO authenticated;
GRANT ALL ON public.smtp_config TO service_role;

ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin manages smtp_config" ON public.smtp_config;
CREATE POLICY "Super admin manages smtp_config"
  ON public.smtp_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 2) Coluna administradora_email no condomínio
ALTER TABLE public.condominiums
  ADD COLUMN IF NOT EXISTS administradora_email TEXT;

-- 3) Logs de envio
CREATE TABLE IF NOT EXISTS public.expired_defense_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurrence_id UUID NOT NULL REFERENCES public.occurrences(id) ON DELETE CASCADE,
  condominium_id UUID NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  recipient_email TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL DEFAULT 'auto' CHECK (triggered_by IN ('auto','manual')),
  triggered_by_user UUID
);

CREATE INDEX IF NOT EXISTS idx_edel_occurrence ON public.expired_defense_email_logs(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_edel_condominium ON public.expired_defense_email_logs(condominium_id);
CREATE INDEX IF NOT EXISTS idx_edel_success ON public.expired_defense_email_logs(success);

GRANT SELECT, INSERT ON public.expired_defense_email_logs TO authenticated;
GRANT ALL ON public.expired_defense_email_logs TO service_role;

ALTER TABLE public.expired_defense_email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads all expired_defense_email_logs" ON public.expired_defense_email_logs;
CREATE POLICY "Super admin reads all expired_defense_email_logs"
  ON public.expired_defense_email_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Sindico reads own condominium expired_defense_email_logs" ON public.expired_defense_email_logs;
CREATE POLICY "Sindico reads own condominium expired_defense_email_logs"
  ON public.expired_defense_email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.condominiums c
      WHERE c.id = expired_defense_email_logs.condominium_id
        AND c.owner_id = auth.uid()
    )
  );

-- 4) Cron diário às 09:00 BRT (12:00 UTC) para envio automático
INSERT INTO public.cron_job_controls (function_name, paused) VALUES
  ('send-expired-defense-email', false)
ON CONFLICT (function_name) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('send-expired-defense-email-daily')
  FROM cron.job
  WHERE jobname = 'send-expired-defense-email-daily';
END $$;

SELECT cron.schedule(
  'send-expired-defense-email-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/send-expired-defense-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{"mode":"auto"}'::jsonb
  );
  $$
);

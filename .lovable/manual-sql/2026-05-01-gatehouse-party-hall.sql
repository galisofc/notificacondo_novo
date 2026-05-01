-- SQL para rodar no Supabase SQL Editor
-- 1) Adiciona campo "WhatsApp da Portaria" no condomínio
ALTER TABLE public.condominiums
  ADD COLUMN IF NOT EXISTS gatehouse_phone text;

COMMENT ON COLUMN public.condominiums.gatehouse_phone IS
  'WhatsApp da portaria - usado para notificar a portaria no dia da reserva do salão de festas';

-- 2) Coluna para rastrear se a notificação para a portaria já foi enviada
ALTER TABLE public.party_hall_bookings
  ADD COLUMN IF NOT EXISTS gatehouse_notification_sent_at timestamptz;

-- 3) Registro de controle do cron (pause/resume)
INSERT INTO public.cron_job_controls (function_name, paused)
VALUES ('notify-gatehouse-party-hall', false)
ON CONFLICT (function_name) DO NOTHING;

-- 4) Agendar o cron no pg_cron (07:00 BR = 10:00 UTC, todos os dias)
SELECT cron.schedule(
  'notify-gatehouse-party-hall-daily',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/notify-gatehouse-party-hall',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

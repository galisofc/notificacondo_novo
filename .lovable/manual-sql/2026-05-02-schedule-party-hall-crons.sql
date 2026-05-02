-- ============================================================
-- Agendar crons do Salão de Festas no pg_cron
-- Rodar no Supabase SQL Editor
-- ============================================================
-- Os horários estão em UTC. Brasília (BRT) = UTC-3.
--   start-party-hall-usage  → roda 08:00 BRT = 11:00 UTC
--   finish-party-hall-usage → roda 23:30 BRT = 02:30 UTC do dia seguinte
--   notify-party-hall-reminders → roda 09:00 BRT = 12:00 UTC

-- 0) Garantir registros de controle (pause/resume)
INSERT INTO public.cron_job_controls (function_name, paused) VALUES
  ('start-party-hall-usage', false),
  ('finish-party-hall-usage', false),
  ('notify-party-hall-reminders', false)
ON CONFLICT (function_name) DO NOTHING;

-- Limpar agendamentos antigos com o mesmo nome (caso já existam)
DO $$
DECLARE jname text;
BEGIN
  FOREACH jname IN ARRAY ARRAY[
    'start-party-hall-usage-daily',
    'finish-party-hall-usage-daily',
    'notify-party-hall-reminders-daily'
  ]
  LOOP
    PERFORM cron.unschedule(jname) FROM cron.job WHERE jobname = jname;
  END LOOP;
END $$;

-- 1) START — coloca reservas confirmadas em "in_use" e dispara WhatsApp do checklist
SELECT cron.schedule(
  'start-party-hall-usage-daily',
  '0 11 * * *',           -- 08:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/start-party-hall-usage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 2) FINISH — encerra reservas que ficaram em "in_use"
SELECT cron.schedule(
  'finish-party-hall-usage-daily',
  '30 2 * * *',           -- 23:30 BRT (do dia anterior)
  $$
  SELECT net.http_post(
    url := 'https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/finish-party-hall-usage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 3) REMINDERS — lembretes para o morador
SELECT cron.schedule(
  'notify-party-hall-reminders-daily',
  '0 12 * * *',           -- 09:00 BRT
  $$
  SELECT net.http_post(
    url := 'https://kcnojeouypwbkkbnbold.supabase.co/functions/v1/notify-party-hall-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Conferir
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname LIKE '%party-hall%'
ORDER BY jobname;

alter table public.whatsapp_messages add column if not exists media_url text;
alter table public.whatsapp_messages add column if not exists media_mime_type text;
alter table public.whatsapp_messages add column if not exists media_id text;
